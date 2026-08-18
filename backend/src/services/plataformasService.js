import { query } from "../config/database.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

export async function listPlataformas() {
  const { rows } = await query("SELECT * FROM plataformas ORDER BY nome ASC");
  return rows;
}

export async function createPlataforma({ nome, tipo, subcanais, file }) {
  let logoUrl = null;
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_VEHICLES_FOLDER || "logos-plataformas");
    logoUrl = upload.secure_url;
  }
  const { rows } = await query(
    "INSERT INTO plataformas (nome, tipo, subcanais, logo_url) VALUES ($1, $2, $3, $4) RETURNING *",
    [nome, tipo || "online", subcanais || [], logoUrl]
  );
  return rows[0];
}

export async function updatePlataforma(id, { nome, tipo, subcanais, file, removerLogo }) {
  let logoUrl;
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_VEHICLES_FOLDER || "logos-plataformas");
    logoUrl = upload.secure_url;
  }
  const { rows } = await query(
    `UPDATE plataformas SET
      nome = COALESCE($2, nome),
      tipo = COALESCE($3, tipo),
      subcanais = COALESCE($4, subcanais),
      logo_url = CASE WHEN $6 THEN NULL ELSE COALESCE($5, logo_url) END
     WHERE id = $1 RETURNING *`,
    [id, nome, tipo, subcanais, logoUrl, Boolean(removerLogo)]
  );
  return rows[0] || null;
}

export async function deletePlataforma(id) {
  const { rowCount } = await query("DELETE FROM plataformas WHERE id = $1", [id]);
  return rowCount > 0;
}
