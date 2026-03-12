#!/usr/bin/env node
/**
 * Teajia Product Sync — Markdown <-> D1
 *
 * Usage:
 *   node scripts/sync-products.mjs import          # Push markdown lore → D1
 *   node scripts/sync-products.mjs import --all    # Push ALL fields from markdown → D1 (full reimport)
 *   node scripts/sync-products.mjs export          # Pull changed products from D1 → markdown
 *   node scripts/sync-products.mjs export --all    # Pull ALL products from D1 → markdown
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
const PRODUCTS_DIR = path.join(PROJECT_ROOT, "products");

// ── Config ──
const API_URL = process.env.TEAJIA_API_URL || "https://teajia-api.lightcodes.workers.dev";
const TOKEN = process.env.TEAJIA_TOKEN || "";

// Token check deferred to import/export commands
function requireToken() {
  if (!TOKEN) {
    console.error("Error: Set TEAJIA_TOKEN environment variable with your admin JWT.");
    console.error("  export TEAJIA_TOKEN='your-jwt-here'");
    process.exit(1);
  }
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
};

// ── YAML Frontmatter Parser (minimal, no dependencies) ──
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlStr = match[1];
  const body = match[2];
  const meta = {};

  let currentKey = null;
  let currentList = null;

  for (const line of yamlStr.split("\n")) {
    // List item
    const listMatch = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
    if (listMatch && currentKey && currentList) {
      currentList.push(listMatch[1]);
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      // Save previous list
      if (currentKey && currentList) {
        meta[currentKey] = currentList;
      }

      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();

      // Check if this starts a list (empty value followed by list items)
      if (!value) {
        currentList = [];
        continue;
      }

      currentList = null;

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parse booleans and numbers
      if (value === "true") value = true;
      else if (value === "false") value = false;

      meta[currentKey] = value;
    }
  }

  // Save last list
  if (currentKey && currentList) {
    meta[currentKey] = currentList;
  }

  return { meta, body };
}

// ── Markdown Section Parser ──
function parseSections(body) {
  const sections = { lore: "" };
  const sectionMap = {
    terroir: "terroir",
    processing: "processingNotes",
    mood: "mood",
    experience: "experience",
  };

  // Split by ## headings
  const parts = body.split(/^## /m);

  // First part (before any ##) is the lore
  sections.lore = parts[0].trim();

  for (let i = 1; i < parts.length; i++) {
    const newlineIdx = parts[i].indexOf("\n");
    if (newlineIdx === -1) continue;

    const heading = parts[i].slice(0, newlineIdx).trim().toLowerCase();
    const content = parts[i].slice(newlineIdx + 1).trim();

    const fieldName = sectionMap[heading];
    if (fieldName) {
      sections[fieldName] = content;
    }
  }

  return sections;
}

// ── Parse cost string like "1200 NT" ──
function parseCost(costStr) {
  if (!costStr) return {};
  const match = String(costStr).match(/^([\d,.]+)\s*(.*)$/);
  if (!match) return {};
  return {
    cost_amount: parseFloat(match[1].replace(/,/g, "")),
    cost_currency: normalizeCurrency(match[2].trim()),
  };
}

function normalizeCurrency(c) {
  if (!c) return "UNK";
  const map = {
    nt: "NT", twd: "NT", ntd: "NT",
    rmb: "Yuan", cny: "Yuan", yuan: "Yuan",
    usd: "USD", "$": "USD",
    idr: "IDR", rp: "IDR",
    jpy: "JPY", yen: "JPY",
    hkd: "HKD", hk: "HKD",
    myr: "MYR",
  };
  return map[c.toLowerCase()] || c;
}

// ── Read all markdown files ──
function readAllProducts() {
  const products = [];
  const categories = fs.readdirSync(PRODUCTS_DIR);

  for (const cat of categories) {
    const catPath = path.join(PRODUCTS_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;

    const files = fs.readdirSync(catPath).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(catPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta, body } = parseFrontmatter(content);
      const sections = parseSections(body);

      products.push({
        filePath,
        relativePath: `${cat}/${file}`,
        meta,
        sections,
      });
    }
  }

  return products;
}

// ── Fetch products from D1 ──
async function fetchD1Products() {
  const res = await fetch(`${API_URL}/api/products`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Match markdown product to D1 product ──
function findMatch(mdProduct, d1Products) {
  const name = (mdProduct.meta.productName || "").toLowerCase().trim();
  const chinese = (mdProduct.meta.chineseName || "").toLowerCase().trim();
  const type = (mdProduct.meta.type || "").toLowerCase().trim();
  const year = String(mdProduct.meta.year || "").toLowerCase().trim();

  // Try exact match on product_name + type
  let matches = d1Products.filter((p) => {
    const pName = (p.product_name || "").toLowerCase().trim();
    const pType = (p.type || "").toLowerCase().trim();
    return pName === name && pType === type;
  });

  // If multiple matches, narrow by year
  if (matches.length > 1 && year && year !== "unknown") {
    const yearMatches = matches.filter((p) => String(p.year || "").toLowerCase().trim() === year);
    if (yearMatches.length > 0) matches = yearMatches;
  }

  // If still multiple, narrow by chinese name
  if (matches.length > 1 && chinese) {
    const cnMatches = matches.filter((p) => (p.chinese_name || "").toLowerCase().trim() === chinese);
    if (cnMatches.length > 0) matches = cnMatches;
  }

  return matches[0] || null;
}

// ── IMPORT: Markdown → D1 ──
async function importToD1(fullImport = false) {
  const mdProducts = readAllProducts();
  const d1Products = await fetchD1Products();

  console.log(`Found ${mdProducts.length} markdown files`);
  console.log(`Found ${d1Products.length} products in D1\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const md of mdProducts) {
    const match = findMatch(md, d1Products);

    if (!match) {
      console.log(`  ? No D1 match: ${md.relativePath} (${md.meta.productName})`);
      notFound++;
      continue;
    }

    // Build update payload
    const payload = {};

    // Always sync prose fields
    if (md.sections.lore) payload.lore = md.sections.lore;
    if (md.sections.terroir) payload.terroir = md.sections.terroir;
    if (md.sections.processingNotes) payload.processing_notes = md.sections.processingNotes;
    if (md.sections.mood) payload.mood = md.sections.mood;
    if (md.sections.experience) payload.experience = md.sections.experience;

    // Sync tasting notes if present
    if (md.meta.tastingNotes && Array.isArray(md.meta.tastingNotes)) {
      payload.tasting_notes = md.meta.tastingNotes;
    }

    // Full import: also sync structured data
    if (fullImport) {
      if (md.meta.givenName) payload.given_name = md.meta.givenName;
      if (md.meta.form) payload.form = md.meta.form;
      if (md.meta.material) payload.material = md.meta.material;
      if (md.meta.capacity) payload.capacity_ml = parseInt(md.meta.capacity) || null;
      if (md.meta.teawareCategory) payload.teaware_category = md.meta.teawareCategory;

      if (md.meta.origin) {
        const parts = md.meta.origin.split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          payload.origin_country = parts[parts.length - 1];
          payload.origin_region = parts.slice(0, -1).join(", ");
        } else {
          payload.origin_country = parts[0];
        }
      }

      const cost = parseCost(md.meta.cost);
      if (cost.cost_amount) payload.cost_amount = cost.cost_amount;
      if (cost.cost_currency) payload.cost_currency = cost.cost_currency;

      if (md.meta.grams) {
        const g = parseInt(String(md.meta.grams).replace(/,/g, ""));
        if (!isNaN(g)) payload.quantity_purchased = g;
      }
      if (md.meta.stock) {
        const s = parseInt(String(md.meta.stock).replace(/,/g, ""));
        if (!isNaN(s)) payload.stock_grams = s;
      }
      if (md.meta.vendor && md.meta.vendor !== "Unknown") {
        payload.vendor = md.meta.vendor;
      }
      if (md.meta.personal === true) payload.is_personal = true;
      if (md.meta.restockable === true) payload.can_reorder = true;
    }

    // Mark lore as custom and visible
    if (payload.lore) {
      payload.is_custom_wisdom = true;
      payload.show_wisdom = true;
    }

    // Mark sync timestamp
    payload.last_synced_at = new Date().toISOString();

    if (Object.keys(payload).length === 0) {
      skipped++;
      continue;
    }

    // PUT to API
    const res = await fetch(`${API_URL}/api/products/${match.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.log(`  ✗ Failed to update ${md.meta.productName}: ${res.status}`);
    } else {
      console.log(`  ✓ ${md.meta.productName}`);
      updated++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped (no changes), ${notFound} not found in D1`);
}

// ── EXPORT: D1 → Markdown ──
async function exportFromD1(exportAll = false) {
  const d1Products = await fetchD1Products();
  const mdProducts = readAllProducts();

  console.log(`Found ${d1Products.length} products in D1`);
  console.log(`Found ${mdProducts.length} existing markdown files\n`);

  // Filter to only changed products if not --all
  let toExport = d1Products;
  if (!exportAll) {
    toExport = d1Products.filter((d1) => {
      // No markdown file exists → needs export
      const md = mdProducts.find((m) => findMatch(m, [d1]) !== null);
      if (!md) return true;

      // Product was updated in admin after last sync
      if (d1.updated_at && d1.last_synced_at) {
        return new Date(d1.updated_at) > new Date(d1.last_synced_at);
      }

      // Has updated_at but never synced → export it
      if (d1.updated_at && !d1.last_synced_at) return true;

      return false;
    });
    console.log(`${toExport.length} products have changes to export\n`);
  }

  let exported = 0;

  for (const d1 of toExport) {
    // Find existing markdown file
    const existingMd = mdProducts.find((m) => {
      const match = findMatch(m, [d1]);
      return match !== null;
    });

    if (existingMd) {
      // Update existing file's frontmatter with latest D1 data
      const content = fs.readFileSync(existingMd.filePath, "utf-8");
      const { meta, body } = parseFrontmatter(content);

      // Update operational fields from D1
      if (d1.stock_grams !== undefined) meta.stock = String(d1.stock_grams);
      if (d1.cost_amount && d1.cost_currency) {
        meta.cost = `${d1.cost_amount} ${d1.cost_currency}`;
      }
      if (d1.given_name) meta.givenName = d1.given_name;
      if (d1.vendor) meta.vendor = d1.vendor;
      if (d1.fixed_retail_price_usd) meta.retailPrice = `${d1.fixed_retail_price_usd} USD`;

      // Rebuild the file
      const newContent = buildMarkdownFromMeta(meta, body);
      fs.writeFileSync(existingMd.filePath, newContent, "utf-8");
      console.log(`  ✓ Updated ${existingMd.relativePath}`);
      exported++;
    } else {
      // Create new markdown file
      const type = d1.type || "Misc";
      const folderMap = {
        Sheng: "sheng", Shou: "shou", Dark: "dark", Oolong: "oolong",
        Red: "red", White: "white", Green: "green", Herbal: "herbal",
        Matcha: "matcha", Flower: "flower", Misc: "misc", Teaware: "teaware",
      };
      const folder = folderMap[type] || "misc";
      const folderPath = path.join(PRODUCTS_DIR, folder);
      fs.mkdirSync(folderPath, { recursive: true });

      const slug = slugify(d1.product_name + (d1.year ? `-${d1.year}` : ""));
      const filePath = path.join(folderPath, `${slug}.md`);

      const meta = {
        productName: d1.product_name || "",
        chineseName: d1.chinese_name || "",
        type: d1.type || "",
        form: d1.form || "",
        year: d1.year || "",
        origin: [d1.origin_region, d1.origin_country].filter(Boolean).join(", "),
        grams: d1.quantity_purchased ? String(d1.quantity_purchased) : "",
        stock: d1.stock_grams ? String(d1.stock_grams) : "",
        cost: d1.cost_amount ? `${d1.cost_amount} ${d1.cost_currency || "UNK"}` : "",
        vendor: d1.vendor || "",
        tastingNotes: d1.tasting_notes || [],
      };

      if (d1.material) meta.material = d1.material;
      if (d1.capacity_ml) meta.capacity = String(d1.capacity_ml);
      if (d1.teaware_category) meta.teawareCategory = d1.teaware_category;
      if (d1.is_personal) meta.personal = true;
      if (d1.can_reorder) meta.restockable = true;

      // Build body from D1 prose
      let body = "";
      if (d1.lore) body += d1.lore + "\n\n";
      if (d1.terroir) body += `## Terroir\n\n${d1.terroir}\n\n`;
      if (d1.processing_notes) body += `## Processing\n\n${d1.processing_notes}\n\n`;
      if (d1.mood) body += `## Mood\n\n${d1.mood}\n\n`;
      if (d1.experience) body += `## Experience\n\n${d1.experience}\n\n`;
      if (!body.trim()) body = "<!-- No lore yet -->\n";

      const newContent = buildMarkdownFromMeta(meta, body);
      fs.writeFileSync(filePath, newContent, "utf-8");
      console.log(`  + Created ${folder}/${slug}.md`);
      exported++;
    }
  }

  console.log(`\nDone: ${exported} files exported`);
}

// ── Helper: Rebuild markdown file from meta + body ──
function buildMarkdownFromMeta(meta, body) {
  const lines = ["---"];

  const yamlSafe = (v) => {
    if (v === undefined || v === null || v === "") return '""';
    const s = String(v);
    if (/[:#{}[\]|>&*!%@`,?]/.test(s) || ["true", "false", "yes", "no"].includes(s.toLowerCase())) {
      return `"${s}"`;
    }
    return s;
  };

  const quote = (v) => (v ? `"${v}"` : '""');

  if (meta.productName) lines.push(`productName: ${quote(meta.productName)}`);
  if (meta.givenName) lines.push(`givenName: ${quote(meta.givenName)}`);
  if (meta.chineseName) lines.push(`chineseName: ${quote(meta.chineseName)}`);
  if (meta.type) lines.push(`type: ${meta.type}`);
  if (meta.form) lines.push(`form: ${yamlSafe(meta.form)}`);
  if (meta.material) lines.push(`material: ${quote(meta.material)}`);
  if (meta.capacity) lines.push(`capacity: ${yamlSafe(meta.capacity)}`);
  if (meta.teawareCategory) lines.push(`teawareCategory: ${yamlSafe(meta.teawareCategory)}`);
  if (meta.year) lines.push(`year: ${yamlSafe(meta.year)}`);
  if (meta.origin) lines.push(`origin: ${quote(meta.origin)}`);
  if (meta.grams) lines.push(`grams: ${yamlSafe(meta.grams)}`);
  if (meta.stock) lines.push(`stock: ${yamlSafe(meta.stock)}`);
  if (meta.cost) lines.push(`cost: ${quote(meta.cost)}`);
  if (meta.vendor) lines.push(`vendor: ${quote(meta.vendor)}`);
  if (meta.retailPrice) lines.push(`retailPrice: ${quote(meta.retailPrice)}`);
  if (meta.personal === true) lines.push("personal: true");
  if (meta.restockable === true) lines.push("restockable: true");

  const notes = Array.isArray(meta.tastingNotes) ? meta.tastingNotes : [];
  if (notes.length > 0) {
    lines.push("tastingNotes:");
    for (const note of notes) {
      lines.push(`  - ${quote(note)}`);
    }
  }

  lines.push("---");
  lines.push("");

  // Body — ensure it ends with a newline
  let bodyStr = (typeof body === "string" ? body : "").trim();
  if (bodyStr) {
    lines.push(bodyStr);
    lines.push("");
  } else {
    lines.push("<!-- No lore yet -->");
    lines.push("");
  }

  return lines.join("\n");
}

function slugify(text) {
  if (!text) return "unnamed";
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .trim()
    .toLowerCase() || "unnamed";
}

// ── CLI ──
const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);

if (command === "import") {
  requireToken();
  const fullImport = flags.includes("--all");
  console.log(fullImport ? "Full import: all fields from markdown → D1" : "Lore import: prose fields from markdown → D1");
  console.log("─".repeat(50));
  importToD1(fullImport).catch(console.error);
} else if (command === "export") {
  requireToken();
  const exportAll = flags.includes("--all");
  console.log(exportAll ? "Full export: all products from D1 → markdown" : "Smart export: changed products from D1 → markdown");
  console.log("─".repeat(50));
  exportFromD1(exportAll).catch(console.error);
} else {
  console.log("Teajia Product Sync");
  console.log("─".repeat(50));
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/sync-products.mjs import          # Push lore from markdown → D1");
  console.log("  node scripts/sync-products.mjs import --all    # Push ALL fields from markdown → D1");
  console.log("  node scripts/sync-products.mjs export          # Pull changed products from D1 → markdown");
  console.log("  node scripts/sync-products.mjs export --all    # Pull ALL products from D1 → markdown");
  console.log("");
  console.log("Environment:");
  console.log("  TEAJIA_TOKEN    Admin JWT token (required)");
  console.log("  TEAJIA_API_URL  API base URL (default: https://teajia-api.lightcodes.workers.dev)");
}
