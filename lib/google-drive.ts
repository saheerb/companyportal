import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadToGoogleDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  const fileId = res.data.id!;

  // Make publicly readable
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export async function fetchFileAsBuffer(urlOrPath: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // Google Drive URL or any https URL — fetch it
  if (urlOrPath.startsWith("http")) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
  }

  // Legacy local path — read from filesystem
  const { readFile } = await import("fs/promises");
  const path = await import("path");
  const ext = path.extname(urlOrPath).toLowerCase().slice(1) || "jpeg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const absolutePath = path.join(process.cwd(), "public", urlOrPath);
  return { buffer: await readFile(absolutePath), mimeType };
}

export function isGoogleDriveUrl(path: string): boolean {
  return path.startsWith("http");
}
