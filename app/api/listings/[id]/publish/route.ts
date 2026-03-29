import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);
  const { platforms } = await req.json() as { platforms: string[] };
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: "platforms array required" }, { status: 400 });
  }

  // Upsert a publication row per platform (mocked as live)
  await Promise.all(
    platforms.map((platform) =>
      pool.query(
        `INSERT INTO listing_publications (listing_id, platform, status, published_at)
         VALUES ($1, $2, 'live', NOW())
         ON CONFLICT (listing_id, platform)
         DO UPDATE SET status = 'live', published_at = NOW()`,
        [id, platform]
      )
    )
  );

  // Mark listing published
  await pool.query(
    `UPDATE car_listings SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return NextResponse.json({ ok: true });
}
