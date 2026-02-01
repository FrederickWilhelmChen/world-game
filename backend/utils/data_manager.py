import json
import os
import threading


class DataManager:
    def __init__(self, data_path):
        self.data_path = data_path
        self._lock = threading.Lock()
        self._cache = None
        self._last_mtime = None

    def _load_from_disk(self):
        with open(self.data_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data, os.path.getmtime(self.data_path)

    def load(self):
        with self._lock:
            if not os.path.exists(self.data_path):
                self._cache = {"metadata": {}, "countries": {}}
                self._last_mtime = None
                return self._cache

            current_mtime = os.path.getmtime(self.data_path)
            if self._cache is None or self._last_mtime != current_mtime:
                self._cache, self._last_mtime = self._load_from_disk()
            return self._cache

    def get_country(self, iso_code):
        if not iso_code:
            return None
        data = self.load()
        countries = data.get("countries", {})
        return countries.get(iso_code.upper())

    def get_metadata(self):
        data = self.load()
        return data.get("metadata", {})
