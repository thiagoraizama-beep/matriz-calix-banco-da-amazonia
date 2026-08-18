import "dotenv/config";
import { initDatabase } from "../config/initDatabase.js";
import { createUser } from "../services/authService.js";
import { getPool } from "../config/database.js";

const email = process.argv[2];
const senha = process.argv[3];
const nome = process.argv[4] || "Administrador";

if (!email || !senha) {
  console.error("Uso: node src/scripts/seedAdmin.js <email> <senha> [nome]");
  process.exit(1);
}

await initDatabase();
const user = await createUser({ email, senha, nome, papel: "agencia", veiculos: [] });
console.log("Usuário Agência criado:", user);
await getPool().end();
