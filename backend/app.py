import os
import sys
from datetime import datetime

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

if __package__ in (None, ""):
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    from backend.api.country_data import country_api
    from backend.utils.data_manager import DataManager
else:
    from .api.country_data import country_api
    from .utils.data_manager import DataManager


def create_app():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_path = os.environ.get(
        "WORLD_GAME_DATA_PATH",
        os.path.join(base_dir, "data", "merged", "countries_data.json"),
    )

    app = Flask(
        __name__,
        static_folder=os.path.join(base_dir, "static"),
        static_url_path="/static",
    )
    app.json.ensure_ascii = False
    CORS(app)

    app.config["DATA_PATH"] = data_path
    app.config["DATA_VERSION"] = "0.1"

    app.register_blueprint(country_api, url_prefix="/api")

    frontend_dir = os.path.join(base_dir, "frontend")

    @app.route("/", methods=["GET"])
    def index():
        return send_from_directory(frontend_dir, "index.html")

    @app.route("/frontend/<path:filename>", methods=["GET"])
    def frontend_assets(filename):
        return send_from_directory(frontend_dir, filename)

    @app.route("/api/health", methods=["GET"])
    def health():
        manager = DataManager(app.config["DATA_PATH"])
        metadata = manager.get_metadata()
        return jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "data_version": metadata.get("version", app.config["DATA_VERSION"]),
                "last_crawl": metadata.get("last_crawl", metadata.get("generated_at")),
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
