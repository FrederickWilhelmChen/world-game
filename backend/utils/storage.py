import json
import os


def get_repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_data_dir(*parts):
    return os.path.join(get_repo_root(), "data", *parts)


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def write_json(path, payload):
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def read_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def latest_json_file(dir_path):
    if not os.path.isdir(dir_path):
        return None
    files = [name for name in os.listdir(dir_path) if name.endswith(".json")]
    if not files:
        return None
    files.sort(key=lambda name: os.path.getmtime(os.path.join(dir_path, name)), reverse=True)
    return os.path.join(dir_path, files[0])
