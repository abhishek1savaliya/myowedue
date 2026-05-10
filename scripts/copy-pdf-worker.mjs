import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js");
const dest = path.join(root, "public", "pdf.worker.min.js");

if (!fs.existsSync(src)) {
  console.warn("copy-pdf-worker: skip — pdf.worker.min.js not found (run npm install).");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("copy-pdf-worker: public/pdf.worker.min.js");
