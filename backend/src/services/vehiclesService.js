import { query } from "../config/database.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

export async function listVehicles() {
  const { rows } = await query("SELECT * FROM vehicles ORDER BY nome ASC");
  return rows;
}

export async function createVehicle({ nome, tipo, file }) {
  let logoUrl = null;
  let publicId = null;
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_VEHICLES_FOLDER || "logos-veiculos");
    logoUrl = upload.secure_url;
    publicId = upload.public_id;
  }

  const { rows } = await query(
    `INSERT INTO vehicles (nome, logo_url, tipo) VALUES ($1, $2, $3) RETURNING *`,
    [nome, logoUrl, tipo || "online"]
  );
  return { ...rows[0], cloudinary_public_id: publicId };
}

export async function updateVehicle(id, { nome, tipo, file, removerLogo }) {
  let logoUrl;
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_VEHICLES_FOLDER || "logos-veiculos");
    logoUrl = upload.secure_url;
  }

  const { rows } = await query(
    `UPDATE vehicles SET
      nome = COALESCE($2, nome),
      logo_url = CASE WHEN $5 THEN NULL ELSE COALESCE($3, logo_url) END,
      tipo = COALESCE($4, tipo)
     WHERE id = $1 RETURNING *`,
    [id, nome, logoUrl, tipo, Boolean(removerLogo)]
  );
  return rows[0] || null;
}

export async function deleteVehicle(id) {
  const { rowCount } = await query("DELETE FROM vehicles WHERE id = $1", [id]);
  return rowCount > 0;
}
