// Copy the web-ready images from design/assets/web into public/images.
// The design folder is the source of truth, so public/images is not committed.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "design", "assets", "web");
const target = join(here, "..", "public", "images");

if (!existsSync(source)) {
  console.error(`copy-assets: ${source} not found`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`copy-assets: copied ${source} to ${target}`);
