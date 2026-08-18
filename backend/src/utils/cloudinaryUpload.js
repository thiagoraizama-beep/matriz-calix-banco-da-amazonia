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
