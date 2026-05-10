# Opening Stock CSV Guide

Use the CSV importer in `/admin/inventory` for the first Australia stock load. Importing is faster and less error-prone than creating every tea manually.

## Minimum useful columns

| Column | Required | Example | Notes |
|---|---:|---|---|
| Type | Yes | Oolong | Tea type or ware type. |
| Product Name | Yes | Alishan High Mountain | Customer-facing name. |
| Given Name | No | Ali High | Short internal/display name. |
| Chinese Name | No | 阿里山 | Use when known. |
| Year | No | 2024 | Harvest or production year. |
| Grams | Recommended | 600 | Original quantity purchased. |
| Stock | Recommended | 550 | Current sellable stock. |
| Cost Amount | Recommended | 3000 | Total cost in cost currency. |
| Cost Currency | Recommended | AUD | Use AUD when stock was bought locally. |
| Vendor | Recommended | Chen Family | Private to the account. |
| Restockable | No | Yes | Use Yes/No. |
| Personal Collection | No | No | Use Yes for private collection stock. |

## First import rules

1. Start with 5 to 10 rows first.
2. Import, review, then repeat with the full sheet.
3. Do not make every product public by default unless the stock is ready to sell.
4. Use draft rows for incomplete items instead of guessing.
5. After import, open Inventory and spot-check price, stock, image, and public state.

## Common slowdowns

### Missing stock units

Teas use grams. Wares use units. If the source file mixes both, split the sheet or be explicit in the product names.

### Cost currency confusion

Use the currency the stock was actually bought in. Retail can still be shown in the store currency.

### Product names that are too internal

Customers need a name they can repeat in WhatsApp. Avoid only using lot numbers or supplier shorthand.

### Missing images

The store can launch with a small number of photographed products. Do not wait for every image if the first public collection is clear.

## Recommended first batch

Launch with a small public shelf:
- 6 to 12 teas
- 1 to 3 teaware items if available
- Clear prices
- Current stock
- At least one image per public item

Keep the rest as drafts until reviewed.

