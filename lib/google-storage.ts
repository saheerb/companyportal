import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs/promises";

function getStorageClient() {
  return new Storage({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
  });
}

export async function uploadToGCS(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const storage = getStorageClient();
  const bucket = storage.bucket(process.env.GOOGLE_STORAGE_BUCKET!);
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
  });

  return `https://storage.googleapis.com/${process.env.GOOGLE_STORAGE_BUCKET}/${filename}`;
}

export async function fetchFileAsBuffer(urlOrPath: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // Remote URL (GCS or any https) — fetch it
  if (urlOrPath.startsWith("http")) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
  }

  // Legacy local path — read from filesystem
  const ext = path.extname(urlOrPath).toLowerCase().slice(1) || "jpeg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const absolutePath = path.join(process.cwd(), "public", urlOrPath);
  return { buffer: await fs.readFile(absolutePath), mimeType };
}
