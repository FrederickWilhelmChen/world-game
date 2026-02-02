from datetime import datetime

import pandas as pd

from ..utils.lag_checker import check_data_freshness
from ..utils.storage import get_data_dir, write_json

OWID_ENERGY_CSV = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"


def crawl_oil():
    df = pd.read_csv(
        OWID_ENERGY_CSV,
        usecols=["iso_code", "year", "oil_production"],
    )
    df = df.dropna(subset=["iso_code", "year", "oil_production"])
    df = df[df["iso_code"].astype(str).str.len() == 3]

    df = df.sort_values(["iso_code", "year"]).groupby("iso_code", as_index=False).tail(1)
    latest_year = int(df["year"].max()) if not df.empty else datetime.utcnow().year - 1

    values = {}
    for row in df.itertuples(index=False):
        iso = str(row.iso_code).upper()
        year = int(row.year)
        production_twh = float(row.oil_production)
        # 1 TWh = 1,000,000 MWh, 1桶石油 ≈ 1.7 MWh
        barrels_per_day = (production_twh * 1_000_000) / 1.7 / 365.0

        data_date = datetime(year, 12, 31)
        values[iso] = {
            "value": barrels_per_day,
            "unit": "桶/日",
            "year": year,
            "month": None,
            "lag_note": check_data_freshness(data_date, max_lag_days=60),
        }

    payload = {
        "last_updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "unit": "桶/日",
        "source": "OWID energy-data (oil_production, TWh -> bbl/day approx)",
        "data": values,
        "latest_year": latest_year,
    }

    file_name = datetime.utcnow().strftime("%Y-%m") + ".json"
    output_path = get_data_dir("raw", "oil", file_name)
    write_json(output_path, payload)
    return payload
