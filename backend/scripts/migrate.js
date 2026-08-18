import "dotenv/config";
import { initDatabase } from "../src/config/initDatabase.js";

await initDatabase();
console.log("Schema aplicado com sucesso.");
process.exit(0);
