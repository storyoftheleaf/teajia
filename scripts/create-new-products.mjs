#!/usr/bin/env node
/**
 * Create new products in D1 from markdown files that don't exist yet.
 * Reads markdown, parses frontmatter + sections, pushes via /api/products/bulk
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
const PRODUCTS_DIR = path.join(PROJECT_ROOT, "products");

// Load .env.local
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  }
}
loadEnv();

const API_URL = process.env.VITE_API_URL || "https://teajia-api.lightcodes.workers.dev";
let token = process.env.TEAJIA_TOKEN || "";
let headers = { "Content-Type": "application/json" };

async function ensureAuth() {
  if (token) { headers.Authorization = `Bearer ${token}`; return; }
  const email = process.env.TEAJIA_ADMIN_EMAIL;
  const password = process.env.TEAJIA_ADMIN_PASSWORD;
  if (!email || !password) { console.error("No auth credentials in .env.local"); process.exit(1); }
  console.log(`Logging in as ${email}...`);
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { console.error(`Login failed: ${res.status}`); process.exit(1); }
  const data = await res.json();
  token = data.token;
  headers.Authorization = `Bearer ${token}`;
  console.log("Authenticated ✓\n");
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const yamlStr = match[1];
  const body = match[2];
  const meta = {};
  let currentKey = null;
  let currentList = null;
  for (const line of yamlStr.split("\n")) {
    const listMatch = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
    if (listMatch && currentKey && currentList) { currentList.push(listMatch[1]); continue; }
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentList) meta[currentKey] = currentList;
      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();
      if (!value) { currentList = []; continue; }
      currentList = null;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      if (value === "true") value = true;
      else if (value === "false") value = false;
      meta[currentKey] = value;
    }
  }
  if (currentKey && currentList) meta[currentKey] = currentList;
  return { meta, body };
}

function parseSections(body) {
  const sections = { lore: "" };
  const sectionMap = { terroir: "terroir", processing: "processing_notes", mood: "mood", experience: "experience" };
  const parts = body.split(/^## /m);
  sections.lore = parts[0].trim();
  for (let i = 1; i < parts.length; i++) {
    const nl = parts[i].indexOf("\n");
    if (nl === -1) continue;
    const heading = parts[i].slice(0, nl).trim().toLowerCase();
    const content = parts[i].slice(nl + 1).trim();
    if (sectionMap[heading]) sections[sectionMap[heading]] = content;
  }
  return sections;
}

function parseCost(costStr) {
  if (!costStr) return {};
  const match = String(costStr).match(/^([\d,.]+)\s*(.*)$/);
  if (!match) return {};
  const currMap = { nt: "NT", twd: "NT", rmb: "Yuan", usd: "USD", idr: "IDR", jpy: "JPY", hkd: "HKD", myr: "MYR" };
  const raw = match[2].trim().toLowerCase();
  return {
    cost_amount: parseFloat(match[1].replace(/,/g, "")),
    cost_currency: currMap[raw] || match[2].trim() || "UNK",
  };
}

function parseOrigin(origin) {
  if (!origin) return {};
  const parts = origin.split(",").map(s => s.trim());
  if (parts.length >= 2) {
    const country = parts[parts.length - 1];
    const region = parts.slice(0, -1).join(", ");
    return { origin_country: country, origin_region: region };
  }
  return { origin_country: origin };
}

// The new files to create
const NEW_FILES = [
  "green/yabukita-green-1930.md",
  "green/yabukita-green-1938.md",
  "oolong/beipu-large-leaf-oolong-1977.md",
  "oolong/nantou-roasted-1983.md",
  "red/assam-yuchi-red-1977.md",
  "red/shuishalian-yuchi-red-1979.md",
  "red/shuishalian-yuchi-red-1980.md",
  "red/shuishalian-yuchi-red-1981.md",
  "sheng/menghai-raw-loose-1976.md",
  "sheng/da-xue-shan-wild-2005.md",
  "sheng/xiaguan-wild-2005.md",
  "sheng/yiwu-wild-2008.md",
  "sheng/red-seal-camphor-puerh-1980.md",
  "sheng/maojian-raw-puerh-1963.md",
  "sheng/tongqinghao-1980.md",
  "white/zhenghe-white-2008-master-bo.md",
  "dark/aged-sour-citrus-tea-1983.md",
  "dark/aged-liu-bao-1960.md",
  "dark/aged-liu-an-1985.md",
  "dark/yaan-kang-brick-1980.md",
];

async function main() {
  await ensureAuth();

  const products = [];

  for (const relPath of NEW_FILES) {
    const filePath = path.join(PRODUCTS_DIR, relPath);
    if (!fs.existsSync(filePath)) {
      console.log(`  ✗ File not found: ${relPath}`);
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const sections = parseSections(body);
    const cost = parseCost(meta.cost);
    const origin = parseOrigin(meta.origin);

    const product = {
      type: meta.type,
      product_name: meta.productName,
      chinese_name: meta.chineseName || "",
      form: meta.form || "",
      year: meta.year && meta.year !== "Unknown" ? meta.year : null,
      ...origin,
      quantity_purchased: meta.grams && meta.grams !== "Unknown" ? parseFloat(meta.grams) : 0,
      stock_grams: meta.stock ? parseFloat(meta.stock) : 0,
      ...cost,
      vendor: meta.vendor || "",
      is_personal: meta.personal === true ? 1 : 0,
      is_public: 0,
      status: "Draft",
      tasting_notes: meta.tastingNotes || [],
      description: sections.lore || "",
      lore: sections.lore || "",
      terroir: sections.terroir || "",
      processing_notes: sections.processing_notes || "",
      mood: sections.mood || "",
      experience: sections.experience || "",
      is_custom_wisdom: 1,
      show_wisdom: 1,
    };

    products.push(product);
    console.log(`  ✓ Parsed: ${meta.productName} (${meta.type}, ${meta.year})`);
  }

  console.log(`\nPushing ${products.length} products to D1...`);

  const res = await fetch(`${API_URL}/api/products/bulk`, {
    method: "POST",
    headers,
    body: JSON.stringify({ products }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Bulk create failed: ${res.status} ${text}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`\nDone: ${result.inserted} products created in D1 ✓`);
}

main().catch(err => { console.error(err); process.exit(1); });
