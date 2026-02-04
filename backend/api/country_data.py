from flask import Blueprint, current_app, jsonify, request

from ..utils.data_manager import DataManager
from ..crawler.eia_oil import crawl_oil
from ..crawler.worldbank_gdp import crawl_gdp
from ..crawler.te_gold_reserves import crawl_gold_reserves
from ..utils.data_merger import merge_all_data

country_api = Blueprint("country_api", __name__)


@country_api.route("/country/<iso_code>", methods=["GET"])
def get_country_data(iso_code):
    manager = DataManager(current_app.config["DATA_PATH"])
    country = manager.get_country(iso_code)
    if not country:
        return jsonify({"error": "Country not found", "code": iso_code.upper()}), 404

    response = {"code": iso_code.upper()}
    response.update(country)
    return jsonify(response)


@country_api.route("/data/refresh", methods=["POST"])
def refresh_data():
    payload = request.get_json(silent=True) or {}
    scope = payload.get("scope", "all")

    if scope == "gdp":
        crawl_gdp()
    elif scope == "oil":
        crawl_oil()
    elif scope == "agriculture":
        # Lazy import to avoid importing pandas on app startup.
        from ..crawler.fao_agriculture import crawl_agriculture

        crawl_agriculture()
    elif scope == "minerals":
        # Lazy import to avoid importing pandas on app startup.
        from ..crawler.usgs_minerals import crawl_minerals

        crawl_minerals()
    elif scope == "gold_reserves":
        crawl_gold_reserves()
    else:
        from ..crawler.fao_agriculture import crawl_agriculture
        from ..crawler.usgs_minerals import crawl_minerals

        crawl_gdp()
        crawl_oil()
        crawl_agriculture()
        crawl_minerals()
        crawl_gold_reserves()

    merged = merge_all_data()
    metadata = merged.get("metadata", {})
    return jsonify(
        {
            "status": "ok",
            "scope": scope,
            "generated_at": metadata.get("generated_at"),
            "last_crawl": metadata.get("last_crawl"),
        }
    )
