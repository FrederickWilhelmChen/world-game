from datetime import datetime

import requests

from ..utils.lag_checker import check_data_freshness
from ..utils.storage import get_data_dir, write_json

WORLD_BANK_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD"
)

EXCLUDED_ISO3 = {
    "AFE",
    "AFW",
    "ARB",
    "CSS",
    "CEB",
    "EAP",
    "EAR",
    "EAS",
    "ECA",
    "ECS",
    "EMU",
    "EUU",
    "FCS",
    "HIC",
    "HPC",
    "IBD",
    "IBT",
    "IDA",
    "IDB",
    "IDX",
    "INX",
    "LAC",
    "LCN",
    "LDC",
    "LIC",
    "LMC",
    "LMY",
    "LTE",
    "MEA",
    "MIC",
    "MNA",
    "NAC",
    "OED",
    "OSS",
    "PRE",
    "PSS",
    "PST",
    "SAS",
    "SSA",
    "SSF",
    "SST",
    "TEA",
    "TEC",
    "TLA",
    "TMN",
    "TSA",
    "TSS",
    "UMC",
    "WLD",
}


def _fetch_gdp():
    page = 1
    all_records = []
    while True:
        response = requests.get(
            WORLD_BANK_URL,
            params={
                "format": "json",
                "per_page": 300,
                "date": "2020:2024",
                "page": page,
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list) or len(payload) < 2:
            break

        meta = payload[0] or {}
        records = payload[1] or []
        all_records.extend(records)

        pages = int(meta.get("pages") or 0)
        if pages <= 0 or page >= pages:
            break
        page += 1

    return all_records


def crawl_gdp():
    records = _fetch_gdp()
    latest_by_country = {}

    for record in records:
        value = record.get("value")
        if value is None:
            continue
        iso_code = record.get("countryiso3code")
        if not iso_code or iso_code == "":
            continue
        if iso_code in EXCLUDED_ISO3:
            continue
        try:
            year = int(record.get("date"))
        except (TypeError, ValueError):
            continue

        existing = latest_by_country.get(iso_code)
        if existing and year <= existing["year"]:
            continue

        data_date = datetime(year, 12, 31)
        latest_by_country[iso_code] = {
            "value": float(value),
            "unit": "USD",
            "year": year,
            "lag_note": check_data_freshness(data_date),
        }

    payload = {
        "last_updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "unit": "USD",
        "data": latest_by_country,
    }

    file_name = datetime.utcnow().strftime("%Y-%m") + ".json"
    output_path = get_data_dir("raw", "gdp", file_name)
    write_json(output_path, payload)
    return payload
