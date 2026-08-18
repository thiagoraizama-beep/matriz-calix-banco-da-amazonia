import { query } from "../config/database.js";

export async function listParceiros() {
  const { rows } = await query(`
    SELECT p.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', e.id,
            'campanha', e.campanha,
            'canais', e.canais
          ) ORDER BY e.campanha
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'
      ) AS escopos
    FROM parceiros p
    LEFT JOIN parceiro_escopos e ON e.parceiro_id = p.id
    GROUP BY p.id
    ORDER BY p.nome ASC
  `);
  return rows;
}

export async function getParceiro(id) {
  const rows = await listParceiros();
  return rows.find((p) => p.id === Number(id)) || null;
}

export async function getEscoposByParceiro(parceiroId) {
  const { rows } = await query(
    "SELECT * FROM parceiro_escopos WHERE parceiro_id = $1 ORDER BY campanha ASC",
    [parceiroId]
  );
  return rows;
}

export async function createParceiro({ nome, tipo }) {
  const { rows } = await query(
    "INSERT INTO parceiros (nome, tipo) VALUES ($1, $2) RETURNING *",
    [nome, tipo]
  );
  return { ...rows[0], escopos: [] };
}

export async function updateParceiro(id, { nome, tipo }) {
  const { rows } = await query(
    `UPDATE parceiros SET
      nome = COALESCE($2, nome),
      tipo = COALESCE($3, tipo)
     WHERE id = $1 RETURNING *`,
    [id, nome, tipo]
  );
  return rows[0] || null;
}

export async function deleteParceiro(id) {
  const { rowCount } = await query("DELETE FROM parceiros WHERE id = $1", [id]);
  return rowCount > 0;
}

export async function upsertEscopo(parceiroId, { campanha, canais }) {
  const { rows } = await query(
    `INSERT INTO parceiro_escopos (parceiro_id, campanha, canais)
     VALUES ($1, $2, $3)
     ON CONFLICT (parceiro_id, campanha)
     DO UPDATE SET canais = EXCLUDED.canais
     RETURNING *`,
    [parceiroId, campanha, canais]
  );
  return rows[0];
}

export async function deleteEscopo(id) {
  const { rowCount } = await query("DELETE FROM parceiro_escopos WHERE id = $1", [id]);
  return rowCount > 0;
}

// Retorna todos os canais que um parceiro pode ver (todos os escopos combinados).
// Usado pelo scopeFilter para autorizar acesso.
export async function getCanaisPermitidos(parceiroId) {
  const { rows } = await query(
    "SELECT campanha, canais FROM parceiro_escopos WHERE parceiro_id = $1",
    [parceiroId]
  );
  return rows; // [{ campanha: "Campanha X", canais: ["Meta", "TikTok"] }]
}
