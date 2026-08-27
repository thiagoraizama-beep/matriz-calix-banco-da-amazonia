import { getCloudinaryClient } from "../config/cloudinary.js";

export function uploadToCloudinary(buffer, mimetype, folder) {
  const cloudinary = getCloudinaryClient();
  const resourceType = mimetype.startsWith("video") ? "video" : "image";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Assinatura pra upload DIRETO do navegador pro Cloudinary, sem o arquivo
// passar pelo backend -- contorna o limite de tamanho de requisicao da
// Vercel (~4.5MB no corpo, bem menor que os 100MB que o multer permitiria),
// que derrubava upload de video com erro 413. O navegador manda o arquivo
// direto pra api.cloudinary.com usando essa assinatura (valida por poucos
// minutos, escopada so a esse folder+timestamp -- nunca expoe api_secret).
export function gerarAssinaturaUpload(folder) {
  const cloudinary = getCloudinaryClient();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
  };
}
