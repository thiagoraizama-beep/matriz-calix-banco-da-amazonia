import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { getPool } from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDatabase() {
  const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await getPool().query(schema);
}
