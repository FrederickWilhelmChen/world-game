import json

# Read the file
with open('data/raw/minerals/2026.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# First, let's check the current values and normalize them
# The correct values should be (in tons):
# USA: aluminum 670000, copper 890000, nickel 8000
# We need to divide by 1000 if values are too large

for country_code, country_data in data['nonferrous']['data'].items():
    if 'by_category' in country_data:
        for metal_type, value in country_data['by_category'].items():
            if isinstance(value, (int, float)):
                # If value is unreasonably large (e.g., > 100 million for aluminum/copper)
                # it was probably multiplied twice, so divide by 1000
                if metal_type in ['aluminum', 'copper'] and value > 10000000:
                    country_data['by_category'][metal_type] = value / 1000
                elif metal_type == 'nickel' and value > 10000000:
                    # Nickel values are typically in thousands (e.g., 2200000 for Indonesia)
                    # But if it's over 10 million, it was also multiplied twice
                    country_data['by_category'][metal_type] = value / 1000

# Write back
with open('data/raw/minerals/2026.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully normalized nonferrous metals data")
