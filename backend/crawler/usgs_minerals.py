from datetime import datetime
import os
import re
from io import BytesIO, StringIO

import pandas as pd
import requests

from ..utils.country_codes import to_iso3
from ..utils.lag_checker import check_data_freshness
from ..utils.storage import get_data_dir, write_json

USGS_MCS_URL = os.environ.get(
    "USGS_MCS_URL",
    "https://prd-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/mineral-commodity-summaries/2024/mcs2024.xlsx",
)

WIKI_GOLD_URL = "https://en.wikipedia.org/wiki/Lists_of_countries_by_mineral_production#Gold"

REQUEST_HEADERS = {
    "User-Agent": "world-game/1.0 (+https://example.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


COMMODITY_KEYS = {
    "aluminum": ["aluminum", "bauxite", "alumina"],
    "copper": ["copper"],
    "nickel": ["nickel"],
    "gold": ["gold"],
}


def _select_year_column(columns):
    candidates = []
    for column in columns:
        try:
            year = int(str(column).strip())
        except ValueError:
            continue
        candidates.append((column, year))
    if not candidates:
        return None, None
    return max(candidates, key=lambda item: item[1])


def _find_country_column(columns):
    for column in columns:
        name = str(column).lower()
        if "country" in name:
            return column
    return None


def _extract_sheet_data(df, year):
    country_column = _find_country_column(df.columns)
    if not country_column:
        return {}

    value_column, column_year = _select_year_column(df.columns)
    if not value_column:
        return {}

    data = {}
    for _, row in df.iterrows():
        name = str(row.get(country_column, "")).strip()
        if not name or name.lower() in {"world", "total"}:
            continue

        iso = to_iso3(name)
        if not iso:
            continue

        value = pd.to_numeric(row.get(value_column), errors="coerce")
        if pd.isna(value):
            continue

        data[iso] = {
            "value": float(value),
            "year": column_year or year,
        }
    return data


def _load_workbook():
    response = requests.get(USGS_MCS_URL, headers=REQUEST_HEADERS, timeout=60)
    response.raise_for_status()
    return pd.ExcelFile(BytesIO(response.content))


def _fallback_empty(source_note):
    return {
        "last_updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": source_note,
        "nonferrous": {"unit": "吨/年", "data": {}},
        "gold": {"unit": "公斤/年", "data": {}},
    }


def _flatten_columns(columns):
    flattened = []
    for column in columns:
        if isinstance(column, tuple):
            parts = [str(part) for part in column if part and str(part) != "nan"]
            flattened.append(" ".join(parts).strip())
        else:
            flattened.append(str(column).strip())
    return flattened


def _detect_gold_year(html):
    match = re.search(r"gold production[^\d]*(\d{4})", html, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return datetime.utcnow().year - 1


def _select_gold_table(tables):
    for table in tables:
        columns = _flatten_columns(table.columns)
        lower_columns = [column.lower() for column in columns]
        if any("country" in column for column in lower_columns) and any(
            "gold" in column or "production" in column for column in lower_columns
        ):
            table.columns = columns
            return table
    return None


def _crawl_gold_wikipedia():
    try:
        response = requests.get(WIKI_GOLD_URL, headers=REQUEST_HEADERS, timeout=60)
        response.raise_for_status()
        html = response.text
    except requests.RequestException as exc:
        return {}, None, f"Wikipedia fetch failed: {exc}"
    try:
        tables = pd.read_html(StringIO(html))
    except Exception as exc:
        return {}, None, f"Wikipedia parse failed: {exc}"
    table = _select_gold_table(tables)
    if table is None:
        return {}, None, "Wikipedia gold table not found"

    year = _detect_gold_year(html)
    country_col = next(
        (column for column in table.columns if "country" in column.lower()), None
    )
    production_col = None
    for column in table.columns:
        column_lower = column.lower()
        if "production" in column_lower and "reserve" not in column_lower:
            if "gold" in column_lower or production_col is None:
                production_col = column
    if not country_col or not production_col:
        return {}, year, "Wikipedia gold columns not found"

    gold_data = {}
    for _, row in table.iterrows():
        name = str(row.get(country_col, "")).strip()
        if not name:
            continue
        lower_name = name.lower()
        if lower_name in {"world", "other countries"}:
            continue

        iso = to_iso3(name)
        if not iso:
            continue
        value = pd.to_numeric(row.get(production_col), errors="coerce")
        if pd.isna(value):
            continue
        value_kg = float(value) * 1000.0
        data_date = datetime(year, 12, 31)
        gold_data[iso] = {
            "value": value_kg,
            "unit": "公斤/年",
            "year": year,
            "lag_note": check_data_freshness(data_date, max_lag_days=365),
        }

    source_note = "Wikipedia list of countries by gold production"
    return gold_data, year, source_note


def crawl_minerals():
    try:
        workbook = _load_workbook()
    except requests.RequestException:
        gold_data, gold_year, gold_source = _crawl_gold_wikipedia()
        payload = _fallback_empty("USGS MCS blocked (403)")
        if gold_data:
            payload["gold"]["data"] = gold_data
            payload["gold"]["source"] = gold_source
            payload["gold"]["year"] = gold_year
            payload["source"] = "USGS MCS blocked (403); gold from Wikipedia"
        file_name = datetime.utcnow().strftime("%Y") + ".json"
        output_path = get_data_dir("raw", "minerals", file_name)
        write_json(output_path, payload)
        return payload
    sheet_map = {name.lower(): name for name in workbook.sheet_names}

    nonferrous_data = {}
    gold_data = {}
    target_year = datetime.utcnow().year - 1

    for commodity, keywords in COMMODITY_KEYS.items():
        sheet_name = None
        for key in keywords:
            for candidate in sheet_map:
                if key in candidate:
                    sheet_name = sheet_map[candidate]
                    break
            if sheet_name:
                break
        if not sheet_name:
            continue

        df = workbook.parse(sheet_name)
        values = _extract_sheet_data(df, target_year)
        if not values:
            continue

        for iso, entry in values.items():
            year = entry.get("year", target_year)
            data_date = datetime(year, 12, 31)
            lag_note = check_data_freshness(data_date, max_lag_days=365)

            if commodity == "gold":
                value_kg = float(entry["value"]) * 1000.0
                gold_data[iso] = {
                    "value": value_kg,
                    "unit": "公斤/年",
                    "year": year,
                    "lag_note": lag_note,
                }
            else:
                entry_payload = nonferrous_data.setdefault(
                    iso,
                    {
                        "unit": "吨/年",
                        "by_category": {},
                        "year": year,
                        "lag_note": lag_note,
                    },
                )
                entry_payload["by_category"][commodity] = entry["value"]
                entry_payload["year"] = max(entry_payload["year"], year)
                entry_payload["lag_note"] = lag_note

    if not gold_data:
        wiki_gold_data, wiki_year, wiki_source = _crawl_gold_wikipedia()
        if wiki_gold_data:
            gold_data = wiki_gold_data

    payload = {
        "last_updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "nonferrous": {"unit": "吨/年", "data": nonferrous_data},
        "gold": {"unit": "公斤/年", "data": gold_data},
    }
    if gold_data and "gold" in payload:
        payload["gold"]["source"] = "USGS MCS (xlsx) or Wikipedia fallback"

    file_name = datetime.utcnow().strftime("%Y") + ".json"
    output_path = get_data_dir("raw", "minerals", file_name)
    write_json(output_path, payload)
    return payload
