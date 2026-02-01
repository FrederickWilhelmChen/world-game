from datetime import datetime
import os

from dateutil import parser

from .storage import get_data_dir, latest_json_file, read_json, write_json


def _parse_timestamp(value):
    if not value:
        return None
    try:
        return parser.parse(value)
    except (ValueError, TypeError):
        return None


def _load_latest(dir_path):
    latest_path = latest_json_file(dir_path)
    if not latest_path:
        return None
    return read_json(latest_path)


def merge_all_data():
    merged_path = get_data_dir("merged", "countries_data.json")
    base_data = {}
    if os.path.exists(merged_path):
        base_data = read_json(merged_path)

    base_countries = base_data.get("countries", {})
    merged_countries = {}
    last_updated_values = []

    def ensure_country(code):
        if code not in merged_countries:
            merged_countries[code] = {}
            base_entry = base_countries.get(code, {})
            for key in ("name", "name_zh", "capital"):
                if key in base_entry:
                    merged_countries[code][key] = base_entry[key]
        return merged_countries[code]

    gdp = _load_latest(get_data_dir("raw", "gdp"))
    if gdp:
        last_updated_values.append(gdp.get("last_updated"))
        for code, entry in gdp.get("data", {}).items():
            country = ensure_country(code)
            country["gdp"] = {
                "value": entry.get("value"),
                "unit": entry.get("unit", gdp.get("unit", "USD")),
                "year": entry.get("year"),
                "lag_note": entry.get("lag_note"),
            }

    oil = _load_latest(get_data_dir("raw", "oil"))
    if oil:
        last_updated_values.append(oil.get("last_updated"))
        for code, entry in oil.get("data", {}).items():
            country = ensure_country(code)
            country["oil_production"] = {
                "value": entry.get("value"),
                "unit": entry.get("unit", oil.get("unit", "桶/日")),
                "year": entry.get("year"),
                "month": entry.get("month"),
                "lag_note": entry.get("lag_note"),
            }

    agriculture = _load_latest(get_data_dir("raw", "agriculture"))
    if agriculture:
        last_updated_values.append(agriculture.get("last_updated"))
        for code, entry in agriculture.get("data", {}).items():
            country = ensure_country(code)
            country["grain_production"] = {
                "total": entry.get("total"),
                "unit": entry.get("unit", agriculture.get("unit", "吨/年")),
                "by_category": entry.get("by_category", {}),
                "year": entry.get("year"),
                "lag_note": entry.get("lag_note"),
            }

    minerals = _load_latest(get_data_dir("raw", "minerals"))
    if minerals:
        last_updated_values.append(minerals.get("last_updated"))

        nonferrous = minerals.get("nonferrous", {})
        for code, entry in nonferrous.get("data", {}).items():
            country = ensure_country(code)
            country["nonferrous_metals"] = {
                "unit": entry.get("unit", nonferrous.get("unit", "吨/年")),
                "by_category": entry.get("by_category", {}),
                "year": entry.get("year"),
                "lag_note": entry.get("lag_note"),
            }

        gold = minerals.get("gold", {})
        for code, entry in gold.get("data", {}).items():
            country = ensure_country(code)
            country["gold_production"] = {
                "value": entry.get("value"),
                "unit": entry.get("unit", gold.get("unit", "吨/年")),
                "year": entry.get("year"),
                "lag_note": entry.get("lag_note"),
            }
            if entry.get("source") or gold.get("source"):
                country["gold_production"]["source"] = entry.get(
                    "source", gold.get("source")
                )

    metadata = base_data.get("metadata", {})
    version = metadata.get("version", "0.1")
    parsed_updates = [value for value in (_parse_timestamp(value) for value in last_updated_values) if value]
    last_crawl = max(parsed_updates).isoformat(timespec="seconds") + "Z" if parsed_updates else None

    merged_data = {
        "metadata": {
            "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "version": version,
            "last_crawl": last_crawl or metadata.get("last_crawl"),
        },
        "countries": merged_countries,
    }

    write_json(merged_path, merged_data)
    return merged_data
