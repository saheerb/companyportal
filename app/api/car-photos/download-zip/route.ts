import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { fetchFileAsBuffer } from "@/lib/google-storage";
import archiver from "archiver";
import { Readable } from "node:stream";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const inventoryId = req.nextUrl.searchParams.get("inventory_id");
  if (!inventoryId) return new NextResponse("inventory_id required", { status: 400 });

  // Fetch car reg for filename and photos
  const [carResult, photosResult] = await Promise.all([
    pool.query(`SELECT reg FROM inventory WHERE id = $1`, [parseInt(inventoryId)]),
    pool.query(
      `SELECT cp.id, cp.file_path, cp.label,
         csp.file_path AS active_file_path
       FROM car_photos cp
       LEFT JOIN car_showroom_photos csp ON csp.id = cp.active_showroom_id
       WHERE cp.inventory_id = $1
       ORDER BY cp.sort_order, cp.id`,
      [parseInt(inventoryId)]
    ),
  ]);

  const reg: string = carResult.rows[0]?.reg ?? "photos";
  const photos = photosResult.rows as { id: number; file_path: string; label: string | null; active_file_path: string | null }[];

  if (photos.length === 0) {
    return new NextResponse("No photos found", { status: 404 });
  }

  // Build ZIP stream
  const archive = archiver("zip", { zlib: { level: 6 } });

  // Fetch all photos and add to archive
  await Promise.all(
    photos.map(async (photo, idx) => {
      const src = photo.active_file_path ?? photo.file_path;
      try {
        const { buffer, mimeType } = await fetchFileAsBuffer(src);
        const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
        const name = photo.label
          ? `${String(idx + 1).padStart(2, "0")}_${photo.label.replace(/[^a-z0-9]/gi, "_")}.${ext}`
          : `${String(idx + 1).padStart(2, "0")}_photo_${photo.id}.${ext}`;
        archive.append(buffer, { name });
      } catch {
        // skip failed photos
      }
    })
  );

  archive.finalize();

  // Convert archiver stream to Web ReadableStream
  const nodeStream = Readable.from(archive);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
  });

  const safeReg = reg.replace(/[^a-z0-9]/gi, "_");
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="photos_${safeReg}.zip"`,
    },
  });
}
