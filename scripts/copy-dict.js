import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(__dirname, "../node_modules/kuromoji/dict");
const dest = path.join(__dirname, "../public/dict");

if (!fs.existsSync(dest)) {
	fs.mkdirSync(dest, { recursive: true });
}

fs.cpSync(source, dest, { recursive: true });
console.log("Copied kuromoji dict to public/dict successfully.");
