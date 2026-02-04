from __future__ import annotations

import calendar
import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from ..utils.country_codes import to_iso3
from ..utils.lag_checker import check_data_freshness
from ..utils.storage import get_data_dir, write_json


TE_GOLD_RESERVES_URL = "https://zh.tradingeconomics.com/country-list/gold-reserves"

REQUEST_HEADERS = {
    "User-Agent": "world-game/0.1 (+https://example.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _parse_number(text: str | None):
    if text is None:
        return None
    raw = str(text).strip().replace(",", "")
    if raw in {"", "-", "N/A"}:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _slug_to_name(slug: str):
    slug = (slug or "").strip().strip("/")
    if not slug:
        return None
    name = slug.replace("-", " ").strip()
    overrides = {
        "cote d ivoire": "Ivory Coast",
        "ivory coast": "Ivory Coast",
        "south korea": "Korea, South",
        "north korea": "Korea, North",
        "cape verde": "Cabo Verde",
        "czech republic": "Czechia",
        "united states": "United States",
        "united kingdom": "United Kingdom",
        "united arab emirates": "United Arab Emirates",
        "turkey": "Turkey",
        "niger": "Niger",
        "taiwan": "Taiwan",
    }
    lowered = name.lower()
    return overrides.get(lowered, name)


def crawl_gold_reserves():
    response = requests.get(TE_GOLD_RESERVES_URL, headers=REQUEST_HEADERS, timeout=60)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    table = soup.select_one("table.table-heatmap")
    if not table:
        raise RuntimeError("TradingEconomics gold reserves table not found")

    values = {}
    latest_year = None
    latest_month = None
    unit = "吨"

    for row in table.select("tr"):
        tds = row.find_all("td")
        if not tds or len(tds) < 4:
            continue

        link = tds[0].find("a")
        href = (link.get("href") if link else "") or ""
        # e.g. /united-states/gold-reserves
        slug = href.strip("/").split("/")[0] if href else ""
        name_for_iso = _slug_to_name(slug)
        iso = to_iso3(name_for_iso)
        if not iso:
            continue

        recent = _parse_number(tds[1].get_text(" ", strip=True))
        if recent is None:
            continue
        previous = _parse_number(tds[2].get_text(" ", strip=True))

        ref_text = tds[3].get_text(" ", strip=True)
        match = re.search(r"(\d{4})-(\d{2})", ref_text)
        year = None
        month = None
        if match:
            year = int(match.group(1))
            month = int(match.group(2))
            latest_year = year if latest_year is None else max(latest_year, year)
            if latest_month is None or (year, month) > latest_month:
                latest_month = (year, month)

        if len(tds) >= 5:
            row_unit = tds[4].get_text(" ", strip=True) or ""
            if row_unit:
                unit = row_unit

        if year and month:
            last_day = calendar.monthrange(year, month)[1]
            data_date = datetime(year, month, last_day)
        else:
            data_date = datetime.utcnow()

        values[iso.upper()] = {
            "value": float(recent),
            "previous": float(previous) if previous is not None else None,
            "unit": unit,
            "year": year,
            "month": month,
            "lag_note": check_data_freshness(data_date, max_lag_days=90),
        }

    payload = {
        "last_updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "unit": unit,
        "source": "Trading Economics (Gold Reserves)",
        "data": values,
        "latest_year": latest_year,
        "latest_month": f"{latest_month[0]}-{latest_month[1]:02d}" if latest_month else None,
        "url": TE_GOLD_RESERVES_URL,
    }

    file_name = datetime.utcnow().strftime("%Y-%m") + ".json"
    output_path = get_data_dir("raw", "gold_reserves", file_name)
    write_json(output_path, payload)
    return payload
