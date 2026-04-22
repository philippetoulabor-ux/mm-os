import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dst = path.join(root, "public/pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.warn("copy-pdf-worker: pdf.worker.min.mjs not found (skip)");
  process.exit(0);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log("copy-pdf-worker: public/pdf.worker.min.mjs");
