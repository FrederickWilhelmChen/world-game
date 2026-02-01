import pycountry

SPECIAL_CASES = {
    "Bolivia": "BOL",
    "Brunei": "BRN",
    "Congo, Dem. Rep.": "COD",
    "Congo, Rep.": "COG",
    "Czechia": "CZE",
    "Egypt": "EGY",
    "Hong Kong": "HKG",
    "Iran": "IRN",
    "Ivory Coast": "CIV",
    "Korea, North": "PRK",
    "Korea, South": "KOR",
    "Laos": "LAO",
    "Moldova": "MDA",
    "North Macedonia": "MKD",
    "Russia": "RUS",
    "Syria": "SYR",
    "Taiwan": "TWN",
    "Tanzania": "TZA",
    "Turkey": "TUR",
    "Venezuela": "VEN",
    "Vietnam": "VNM",
}


def to_iso3(value):
    if not value:
        return None
    code = str(value).strip()
    if not code:
        return None

    if len(code) == 3 and code.isalpha():
        return code.upper()

    if code in SPECIAL_CASES:
        return SPECIAL_CASES[code]

    normalized = code.replace("&", "and")
    try:
        match = pycountry.countries.search_fuzzy(normalized)[0]
        return match.alpha_3
    except LookupError:
        return None
