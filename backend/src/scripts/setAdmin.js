import "dotenv/config";
import { initDatabase } from "../config/initDatabase.js";
import { query, getPool } from "../config/database.js";

const email = process.argv[2];

if (!email) {
  console.error("Uso: node src/scripts/setAdmin.js <email>");
  process.exit(1);
}

await initDatabase();

const { rows } = await query(
  "UPDATE users SET is_admin = true WHERE email = $1 RETURNING id, email, nome, papel, is_admin",
  [email]
);

if (!rows[0]) {
  console.error(`Nenhum usuário encontrado com o e-mail "${email}". Nada foi alterado.`);
  process.exit(1);
}

console.log("Usuário marcado como admin (acesso à Lixeira):", rows[0]);
await getPool().end();
