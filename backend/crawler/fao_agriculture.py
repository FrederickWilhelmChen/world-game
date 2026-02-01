from datetime import datetime

import pandas as pd
import requests
from io import StringIO

from ..utils.lag_checker import check_data_freshness
from ..utils.storage import get_data_dir, write_json

OWID_CSVS = {
    "wheat": "https://ourworldindata.org/grapher/wheat-production.csv",
    "rice": "https://ourworldindata.org/grapher/rice-production.csv",
    "corn": "https://ourworldindata.org/grapher/maize-production.csv",
}


def _fetch_category(url):
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    df = pd.read_csv(StringIO(response.text))
    df = df.rename(columns={"Entity": "country", "Code": "iso_code"})
    value_col = df.columns[-1]
    df = df[["iso_code", "Year", value_col]].dropna(subset=["iso_code", "Year", value_col])
    df = df[df["iso_code"].astype(str).str.len() == 3]
    df["Year"] = df["Year"].astype(int)
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[value_col])
    df = df.sort_values(["iso_code", "Year"]).groupby("iso_code", as_index=False).tail(1)
    return df, value_col


def crawl_agriculture():
    data_by_country = {}
    target_year = None

    for category, url in OWID_CSVS.items():
        df, value_col = _fetch_category(url)
        if df.empty:
            continue
        if target_year is None:
            target_year = int(df["Year"].max())

        for _, row in df.iterrows():
            iso = str(row["iso_code"]).upper()
            year = int(row["Year"])
            value = float(row[value_col])

            entry = data_by_country.setdefault(
                iso,
                {"total": 0, "unit": "吨/年", "by_category": {}, "year": year},
            )
            entry["by_category"][category] = value
            entry["year"] = max(entry.get("year", year), year)

    for entry in data_by_country.values():
        entry["total"] = sum(entry["by_category"].values())
        data_date = datetime(entry["year"], 12, 31)
        entry["lag_note"] = check_data_freshness(data_date, max_lag_days=365)

    payload = {
        "last_updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "unit": "吨/年",
        "source": "Our World in Data grapher (wheat/rice/maize production)",
        "data": data_by_country,
        "latest_year": target_year,
    }

    file_name = datetime.utcnow().strftime("%Y") + ".json"
    output_path = get_data_dir("raw", "agriculture", file_name)
    write_json(output_path, payload)
    return payload
