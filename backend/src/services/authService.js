import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../config/database.js";
import { getCanaisPermitidos } from "./parceirosService.js";
import { getEscoposUsuario } from "./campanhasService.js";
import { tiposMidiaPermitidos } from "../utils/scopeFilter.js";
import { sendPasswordResetEmail } from "./emailService.js";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "7d";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function toPublicUser(row, escopos = null) {
  const base = {
    id: row.id,
    email: row.email,
    nome: row.nome,
    papel: row.papel,
    veiculos: row.veiculos,
    parceiroId: row.parceiro_id || null,
    escopos: escopos || null,
    fotoUrl: row.foto_url,
  };
  base.tiposMidia = tiposMidiaPermitidos(base);
  return base;
}

// Resolve os vinculos de campanha+plataformas+tipo_midia do usuario, usados
// pelo frontend para filtrar dados e montar o menu de navegacao.
// - papel "parceiro" (sistema antigo de parceiros): busca por parceiro_id
// - papel "veiculo": busca pelos nomes de veiculo vinculados via campanha_veiculos
async function resolveEscopos(user) {
  if (user.papel === "parceiro" && user.parceiro_id) {
    return getCanaisPermitidos(user.parceiro_id);
  }
  if (user.papel === "veiculo" && user.veiculos?.length) {
    return getEscoposUsuario(user.veiculos);
  }
  return null;
}

export async function login(email, senha) {
  const { rows } = await query("SELECT * FROM users WHERE email = $1 AND ativo = true", [email]);
  const user = rows[0];
  if (!user) return null;

  const valid = await bcrypt.compare(senha, user.password_hash);
  if (!valid) return null;

  const escopos = await resolveEscopos(user);
  const token = jwt.sign({ id: user.id, papel: user.papel }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { token, user: toPublicUser(user, escopos) };
}

export async function getPublicAvatar(email) {
  if (!email) return null;
  const { rows } = await query(
    "SELECT nome, foto_url FROM users WHERE email = $1 AND ativo = true",
    [email]
  );
  const user = rows[0];
  if (!user) return null;
  return { nome: user.nome, fotoUrl: user.foto_url };
}

export async function getUserById(id) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1 AND ativo = true", [id]);
  if (!rows[0]) return null;
  const escopos = await resolveEscopos(rows[0]);
  return toPublicUser(rows[0], escopos);
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function createUser({ email, senha, nome, papel, veiculos, parceiroId }) {
  const passwordHash = await bcrypt.hash(senha, 10);

  const { rows: existentes } = await query("SELECT id FROM users WHERE email = $1 AND ativo = false", [email]);
  if (existentes[0]) {
    const { rows } = await query(
      `UPDATE users SET
        password_hash = $2,
        nome = $3,
        papel = $4,
        veiculos = $5,
        parceiro_id = $6,
        foto_url = NULL,
        ativo = true
       WHERE id = $1
       RETURNING *`,
      [existentes[0].id, passwordHash, nome, papel, veiculos || [], parceiroId || null]
    );
    const escopos = await resolveEscopos(rows[0]);
    return toPublicUser(rows[0], escopos);
  }

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, nome, papel, veiculos, parceiro_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [email, passwordHash, nome, papel, veiculos || [], parceiroId || null]
  );
  const escopos = await resolveEscopos(rows[0]);
  return toPublicUser(rows[0], escopos);
}

export async function listUsers() {
  const { rows } = await query("SELECT * FROM users WHERE ativo = true ORDER BY criado_em DESC");
  return rows.map(toPublicUser);
}

export async function updateProfile(id, { nome, fotoUrl, removerFoto }) {
  const novaFotoUrl = removerFoto ? null : fotoUrl;
  const { rows } = await query(
    `UPDATE users SET
      nome = COALESCE($2, nome),
      foto_url = CASE WHEN $4 THEN NULL ELSE COALESCE($3, foto_url) END
     WHERE id = $1
     RETURNING *`,
    [id, nome, novaFotoUrl, Boolean(removerFoto)]
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

// Agencia pode trocar o papel (e veiculos vinculados, se for o caso) de
// outro usuario sem precisar excluir e recriar a conta.
// Edição completa de usuario (sem senha) pela agencia.
export async function updateUser(id, { nome, email, papel, veiculos, parceiroId }) {
  const { rows } = await query(
    `UPDATE users SET
      nome = COALESCE($2, nome),
      email = COALESCE($3, email),
      papel = COALESCE($4, papel),
      veiculos = COALESCE($5, veiculos),
      parceiro_id = $6
     WHERE id = $1 AND ativo = true
     RETURNING *`,
    [id, nome, email, papel, veiculos, parceiroId || null]
  );
  if (!rows[0]) return null;
  const escopos = await resolveEscopos(rows[0]);
  return toPublicUser(rows[0], escopos);
}

export async function updateUserRole(id, { papel, veiculos, parceiroId }) {
  const { rows } = await query(
    `UPDATE users SET
      papel = COALESCE($2, papel),
      veiculos = COALESCE($3, veiculos),
      parceiro_id = $4
     WHERE id = $1 AND ativo = true
     RETURNING *`,
    [id, papel, veiculos, parceiroId || null]
  );
  if (!rows[0]) return null;
  const escopos = await resolveEscopos(rows[0]);
  return toPublicUser(rows[0], escopos);
}

// Desativa em vez de excluir de fato, para preservar o historico
// (criativos/status apontam para o usuario via foreign key).
export async function deactivateUser(id) {
  const { rowCount } = await query("UPDATE users SET ativo = false WHERE id = $1", [id]);
  return rowCount > 0;
}

export async function changePassword(id, senhaAtual, novaSenha) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
  const user = rows[0];
  if (!user) return { ok: false, error: "Usuário não encontrado" };

  const valid = await bcrypt.compare(senhaAtual, user.password_hash);
  if (!valid) return { ok: false, error: "Senha atual incorreta" };

  const passwordHash = await bcrypt.hash(novaSenha, 10);
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
  return { ok: true };
}

export async function requestPasswordReset(email) {
  const { rows } = await query("SELECT id, email FROM users WHERE email = $1 AND ativo = true", [email]);
  const user = rows[0];
  if (!user) return { ok: false, error: "Este e-mail não está cadastrado" };

  const token = crypto.randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await query("UPDATE password_reset_tokens SET usado = true WHERE user_id = $1 AND usado = false", [user.id]);
  await query(
    "INSERT INTO password_reset_tokens (user_id, token, expira_em) VALUES ($1, $2, $3)",
    [user.id, token, expiraEm]
  );

  const link = `${FRONTEND_URL}/redefinir-senha?token=${token}`;
  await sendPasswordResetEmail(user.email, link);
  return { ok: true };
}

export async function validateResetToken(token) {
  const { rows } = await query(
    "SELECT user_id, expira_em, usado FROM password_reset_tokens WHERE token = $1",
    [token]
  );
  const row = rows[0];
  if (!row || row.usado || new Date(row.expira_em) < new Date()) return false;
  return true;
}

export async function resetPasswordWithToken(token, novaSenha) {
  const { rows } = await query(
    "SELECT user_id, expira_em, usado FROM password_reset_tokens WHERE token = $1",
    [token]
  );
  const row = rows[0];
  if (!row || row.usado || new Date(row.expira_em) < new Date()) {
    return { ok: false, error: "Link inválido ou expirado" };
  }

  const passwordHash = await bcrypt.hash(novaSenha, 10);
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [row.user_id, passwordHash]);
  await query("UPDATE password_reset_tokens SET usado = true WHERE token = $1", [token]);
  return { ok: true };
}
