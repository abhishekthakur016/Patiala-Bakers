import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryEnabled, env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

let configured = false;
function cfg() {
  if (!configured) {
    cloudinary.config({ cloud_name: env.cloudinary.cloudName, api_key: env.cloudinary.apiKey, api_secret: env.cloudinary.apiSecret, secure: true });
    configured = true;
  }
}

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

/** Stores an uploaded image on Cloudinary, or on local disk in development. */
export async function storeImage(file, folder = 'patiala-bakers') {
  if (cloudinaryEnabled()) {
    cfg();
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, res) => (err ? reject(err) : resolve(res)));
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }
  await fs.mkdir(path.join(LOCAL_UPLOAD_DIR, folder), { recursive: true });
  const name = `${crypto.randomBytes(12).toString('hex')}${EXT[file.mimetype] || ''}`;
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, folder, name), file.buffer);
  return { url: `/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}` };
}

export async function deleteImage(publicId) {
  if (!publicId) return;
  if (publicId.startsWith('local:')) {
    const rel = publicId.slice(6);
    if (rel.includes('..')) return;
    await fs.rm(path.join(LOCAL_UPLOAD_DIR, rel), { force: true });
    return;
  }
  if (cloudinaryEnabled()) {
    cfg();
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
}
