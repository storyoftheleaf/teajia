#!/usr/bin/env python3
"""
Convert Teajia CSV files (tea + teaware) into individual Markdown files
with YAML frontmatter and prose sections.

Usage:
  python3 scripts/csv-to-markdown.py

Reads from the CSV files in the Spread Sheets folder and outputs to products/
"""

import csv
import os
import re
import unicodedata

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "products")

TEA_CSV = "/Users/adrianrasmussen/Documents/Files/1 Projects/TeaJia/Spread Sheets/Teajia_Tea_Complete.csv"
TEAWARE_CSV = "/Users/adrianrasmussen/Documents/Files/1 Projects/TeaJia/Spread Sheets/Teajia_Teaware_Complete.csv"

# Type -> subfolder mapping
TYPE_FOLDERS = {
    "Sheng": "sheng",
    "Shou": "shou",
    "Oolong": "oolong",
    "Dark": "dark",
    "Red": "red",
    "White": "white",
    "Green": "green",
    "Herbal": "herbal",
    "Matcha": "matcha",
    "Flower": "flower",
    "Misc": "misc",
    "Teaware": "teaware",
}


def slugify(text):
    """Convert text to a filesystem-safe slug."""
    if not text:
        return "unnamed"
    # Normalize unicode, keep only ASCII
    text = unicodedata.normalize("NFKD", text)
    # Keep alphanumeric, spaces, hyphens
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text.strip()).lower()
    return text or "unnamed"


def yaml_safe(value):
    """Escape a value for YAML frontmatter."""
    if not value:
        return '""'
    value = str(value).strip()
    if not value:
        return '""'
    # Quote if it contains special YAML characters
    if any(c in value for c in ":#{}[]|>&*!%@`,?") or value.lower() in ("true", "false", "yes", "no", "null"):
        return f'"{value}"'
    # Quote if it starts/ends with spaces or quotes
    if value[0] in " '\"" or value[-1] in " '\"":
        return f'"{value}"'
    return value


def yaml_multiword(value):
    """For values that are always quoted."""
    if not value:
        return '""'
    return f'"{value.strip()}"'


def parse_tasting_notes(raw):
    """Parse comma-separated tasting notes into a YAML list."""
    if not raw or not raw.strip():
        return []
    return [n.strip() for n in raw.split(",") if n.strip()]


def build_markdown(product, is_teaware=False):
    """Build a markdown string for a product."""
    lines = ["---"]

    # Core identity
    lines.append(f"productName: {yaml_multiword(product.get('productName', ''))}")
    if product.get("givenName"):
        lines.append(f"givenName: {yaml_multiword(product['givenName'])}")
    if product.get("chineseName"):
        lines.append(f"chineseName: {yaml_multiword(product['chineseName'])}")
    lines.append(f"type: {product.get('type', 'Unknown')}")

    if is_teaware:
        if product.get("material"):
            lines.append(f"material: {yaml_multiword(product['material'])}")
        if product.get("capacity"):
            lines.append(f"capacity: {yaml_safe(product['capacity'])}")
        if product.get("teawareCategory"):
            lines.append(f"teawareCategory: {yaml_safe(product['teawareCategory'])}")
    else:
        if product.get("form"):
            lines.append(f"form: {yaml_safe(product['form'])}")

    if product.get("year"):
        lines.append(f"year: {yaml_safe(product['year'])}")

    # Origin
    origin_parts = []
    if product.get("originRegion"):
        origin_parts.append(product["originRegion"])
    if product.get("originCountry"):
        origin_parts.append(product["originCountry"])
    if origin_parts:
        lines.append(f"origin: {yaml_multiword(', '.join(origin_parts))}")

    # Inventory
    if product.get("grams"):
        lines.append(f"grams: {yaml_safe(product['grams'])}")
    if product.get("stock"):
        lines.append(f"stock: {yaml_safe(product['stock'])}")
    if product.get("costAmount"):
        currency = product.get("currency", "")
        cost_str = f"{product['costAmount']} {currency}".strip()
        lines.append(f"cost: {yaml_multiword(cost_str)}")
    if product.get("vendor"):
        lines.append(f"vendor: {yaml_multiword(product['vendor'])}")

    # Flags
    if product.get("isPersonal"):
        lines.append(f"personal: true")
    if product.get("canReorder"):
        lines.append(f"restockable: true")

    # Tasting notes
    notes = parse_tasting_notes(product.get("tastingNotes", ""))
    if notes:
        lines.append("tastingNotes:")
        for note in notes:
            lines.append(f"  - {yaml_multiword(note)}")

    lines.append("---")
    lines.append("")

    # Prose sections - only include if they have content
    lore = (product.get("lore") or "").strip()
    terroir = (product.get("terroir") or "").strip()
    processing = (product.get("processingNotes") or "").strip()
    mood = (product.get("mood") or "").strip()
    experience = (product.get("experience") or "").strip()

    if lore:
        lines.append(lore)
        lines.append("")

    if terroir:
        lines.append("## Terroir")
        lines.append("")
        lines.append(terroir)
        lines.append("")

    if processing:
        lines.append("## Processing")
        lines.append("")
        lines.append(processing)
        lines.append("")

    if mood:
        lines.append("## Mood")
        lines.append("")
        lines.append(mood)
        lines.append("")

    if experience:
        lines.append("## Experience")
        lines.append("")
        lines.append(experience)
        lines.append("")

    # If no prose at all, leave a placeholder
    if not any([lore, terroir, processing, mood, experience]):
        lines.append("<!-- No lore yet -->")
        lines.append("")

    return "\n".join(lines)


def get_safe_value(row, keys):
    """Try multiple column name variants."""
    for key in keys:
        val = row.get(key, "").strip()
        if val and val.lower() not in ("unknown", "nan", "null", "undefined", "n/a"):
            return val
    # Return raw value even if "Unknown" for some fields
    for key in keys:
        val = row.get(key, "").strip()
        if val:
            return val
    return ""


def parse_tea_row(row):
    """Parse a tea CSV row into a product dict."""
    return {
        "type": get_safe_value(row, ["Type", "Category"]),
        "givenName": get_safe_value(row, ["Given Name", "GivenName"]),
        "chineseName": get_safe_value(row, ["Chinese Name", "ChineseName"]),
        "productName": get_safe_value(row, ["Product Name", "ProductName", "Name"]),
        "form": get_safe_value(row, ["Form"]),
        "year": get_safe_value(row, ["Year"]),
        "originCountry": get_safe_value(row, ["Origin Country", "Country"]),
        "originRegion": get_safe_value(row, ["Origin Region", "Region"]),
        "grams": get_safe_value(row, ["Grams", "Quantity Purchased"]),
        "stock": get_safe_value(row, ["Stock"]),
        "costAmount": get_safe_value(row, ["Cost Amount", "Cost"]),
        "currency": get_safe_value(row, ["Currency", "Cost Currency"]),
        "vendor": get_safe_value(row, ["Vendor"]),
        "isPersonal": get_safe_value(row, ["Personal Collection", "Personal"]).lower() in ("yes", "true", "1", "y"),
        "canReorder": get_safe_value(row, ["Restockable", "Restock"]).lower() in ("yes", "true", "1", "y"),
        "lore": row.get("Lore", "").strip(),
        "tastingNotes": row.get("Tasting Notes", "").strip(),
        "processingNotes": row.get("Processing Notes", "").strip(),
        "terroir": row.get("Terroir", "").strip(),
        "mood": row.get("Mood", "").strip(),
        "experience": row.get("Experience", "").strip(),
    }


def parse_teaware_row(row):
    """Parse a teaware CSV row into a product dict."""
    return {
        "type": "Teaware",
        "givenName": get_safe_value(row, ["Given Name", "GivenName"]),
        "chineseName": get_safe_value(row, ["Chinese Name", "ChineseName"]),
        "productName": get_safe_value(row, ["Product Name", "ProductName", "Name"]),
        "material": get_safe_value(row, ["Material"]),
        "capacity": get_safe_value(row, ["Capacity", "Capacity ML"]),
        "teawareCategory": get_safe_value(row, ["Teaware Category", "Teaware Type"]),
        "grams": get_safe_value(row, ["Grams", "Stock"]),
        "stock": get_safe_value(row, ["Stock"]),
        "costAmount": get_safe_value(row, ["Cost Amount", "Cost"]),
        "currency": get_safe_value(row, ["Currency"]),
        "vendor": get_safe_value(row, ["Vendor"]),
        "canReorder": get_safe_value(row, ["Restockable"]).lower() in ("yes", "true", "1", "y"),
        "lore": row.get("Lore", "").strip(),
        "processingNotes": row.get("Processing Notes", "").strip(),
        "terroir": row.get("Terroir", "").strip(),
        "mood": row.get("Mood", "").strip(),
        "experience": row.get("Experience", "").strip(),
    }


def ensure_unique_filename(folder, base_slug, ext=".md"):
    """If a file already exists, append a number."""
    path = os.path.join(folder, f"{base_slug}{ext}")
    if not os.path.exists(path):
        return path, f"{base_slug}{ext}"
    counter = 2
    while True:
        name = f"{base_slug}-{counter}{ext}"
        path = os.path.join(folder, name)
        if not os.path.exists(path):
            return path, name
        counter += 1


def main():
    products = []

    # Parse tea CSV
    if os.path.exists(TEA_CSV):
        with open(TEA_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                product = parse_tea_row(row)
                if product["productName"] or product["chineseName"]:
                    products.append((product, False))
        print(f"Parsed {sum(1 for p, t in products if not t)} teas from CSV")
    else:
        print(f"Warning: Tea CSV not found at {TEA_CSV}")

    # Parse teaware CSV
    teaware_count_before = len(products)
    if os.path.exists(TEAWARE_CSV):
        with open(TEAWARE_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                product = parse_teaware_row(row)
                if product["productName"] or product["chineseName"]:
                    products.append((product, True))
        print(f"Parsed {len(products) - teaware_count_before} teaware from CSV")
    else:
        print(f"Warning: Teaware CSV not found at {TEAWARE_CSV}")

    print(f"Total: {len(products)} products")
    print()

    # Create folders
    for folder_name in TYPE_FOLDERS.values():
        os.makedirs(os.path.join(OUTPUT_DIR, folder_name), exist_ok=True)

    # Generate markdown files
    index_entries = {}  # type -> [(filename, product)]

    for product, is_teaware in products:
        tea_type = product.get("type", "Misc")
        folder_name = TYPE_FOLDERS.get(tea_type, "misc")
        folder_path = os.path.join(OUTPUT_DIR, folder_name)

        # Build filename from product name + year
        name_parts = []
        if product.get("productName"):
            name_parts.append(product["productName"])
        elif product.get("chineseName"):
            name_parts.append(product["chineseName"])
        if product.get("year") and product["year"].lower() != "unknown":
            name_parts.append(product["year"])

        base_slug = slugify(" ".join(name_parts))
        filepath, filename = ensure_unique_filename(folder_path, base_slug)

        # Generate markdown
        md_content = build_markdown(product, is_teaware)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md_content)

        # Track for index
        if tea_type not in index_entries:
            index_entries[tea_type] = []

        display_name = product.get("productName") or product.get("chineseName") or "Unnamed"
        if product.get("givenName"):
            display_name = f"{product['givenName']} — {display_name}"
        if product.get("year") and product["year"].lower() != "unknown":
            display_name += f" ({product['year']})"

        index_entries[tea_type].append({
            "display": display_name,
            "path": f"{folder_name}/{filename}",
            "chinese": product.get("chineseName", ""),
        })

    # Generate index.md
    index_lines = ["# Teajia Product Collection", ""]

    # Summary
    total = sum(len(entries) for entries in index_entries.values())
    index_lines.append(f"**{total} products** across {len(index_entries)} categories.")
    index_lines.append("")

    # Type order for index
    type_order = ["Sheng", "Shou", "Dark", "Oolong", "Red", "White", "Green", "Herbal", "Matcha", "Flower", "Misc", "Teaware"]

    # Table of contents
    index_lines.append("## Contents")
    index_lines.append("")
    for tea_type in type_order:
        if tea_type in index_entries:
            count = len(index_entries[tea_type])
            anchor = tea_type.lower().replace(" ", "-")
            index_lines.append(f"- [{tea_type}](#{anchor}) ({count})")
    index_lines.append("")

    # Each category
    for tea_type in type_order:
        if tea_type not in index_entries:
            continue
        entries = sorted(index_entries[tea_type], key=lambda e: e["display"])
        index_lines.append(f"## {tea_type}")
        index_lines.append("")
        for entry in entries:
            chinese = f" {entry['chinese']}" if entry["chinese"] else ""
            index_lines.append(f"- [{entry['display']}]({entry['path']}){chinese}")
        index_lines.append("")

    index_path = os.path.join(OUTPUT_DIR, "index.md")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(index_lines))

    print(f"Generated {total} markdown files in {OUTPUT_DIR}/")
    print(f"Generated index.md")
    print()
    for tea_type in type_order:
        if tea_type in index_entries:
            print(f"  {tea_type}: {len(index_entries[tea_type])} files")


if __name__ == "__main__":
    main()
