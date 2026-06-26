import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = join(root, "..", "assets", "left_hand.svg");
const outDir = join(root, "public", "sprites");
const out = join(outDir, "left_hand.svg");

const text = readFileSync(src, "utf8");
const cleaned = text.replace(
  /<path d="M0 0 C413\.82 0 827\.64 0 1254 0[^"]*"[^/]*\/>/,
  "",
);

mkdirSync(outDir, { recursive: true });
writeFileSync(out, cleaned, "utf8");
console.log(`Wrote ${out} (${cleaned.length} bytes)`);
