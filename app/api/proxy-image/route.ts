import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("url required", { status: 400 });

  // Only allow our own GCS bucket
  const bucket = process.env.GOOGLE_STORAGE_BUCKET;
  if (bucket && !url.startsWith(`https://storage.googleapis.com/${bucket}/`)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok) return new NextResponse("Failed to fetch image", { status: 502 });

  const download = req.nextUrl.searchParams.get("download");
  const widthParam = req.nextUrl.searchParams.get("w");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buffer = Buffer.from(await res.arrayBuffer() as any);
  let contentType = res.headers.get("content-type") ?? "image/jpeg";

  // Resize only for display (not downloads), when ?w= is specified
  if (!download && widthParam) {
    const width = Math.min(parseInt(widthParam, 10), 2400);
    if (!isNaN(width) && width > 0) {
      buffer = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      contentType = "image/jpeg";
    }
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      ...(download ? { "Content-Disposition": `attachment; filename="photo.${ext}"` } : {}),
    },
  });
}
