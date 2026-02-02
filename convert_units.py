import json
import sys

# Read the file
with open('data/raw/minerals/2026.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Convert nonferrous metals from thousand tons to tons (multiply by 1000)
for country_code, country_data in data['nonferrous']['data'].items():
    if 'by_category' in country_data:
        for metal_type, value in country_data['by_category'].items():
            if isinstance(value, (int, float)):
                country_data['by_category'][metal_type] = value * 1000

# Write back
with open('data/raw/minerals/2026.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully converted all nonferrous metals data from thousand tons to tons")
