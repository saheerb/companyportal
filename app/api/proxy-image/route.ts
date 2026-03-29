import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";

  const download = req.nextUrl.searchParams.get("download");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      ...(download ? { "Content-Disposition": `attachment; filename="photo.${ext}"` } : {}),
    },
  });
}
