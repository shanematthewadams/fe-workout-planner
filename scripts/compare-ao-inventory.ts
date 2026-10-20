import { readFile } from "node:fs/promises";
import { compareInventory } from "./ao-inventory.ts";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--input")
  throw Error(
    "Use npm run --silent catalog:compare-inventory -- --input inventory.json. Output is review-only JSON on stdout; no apply option exists.",
  );
const raw = await readFile(args[1], "utf8");
if (Buffer.byteLength(raw) > 1000000) throw Error("Inventory exceeds 1 MB.");
console.log(JSON.stringify(compareInventory(JSON.parse(raw)), null, 2));
