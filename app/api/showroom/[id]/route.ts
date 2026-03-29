import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT * FROM car_showroom_photos WHERE id = $1`,
    [parseInt(params.id)]
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const showroomId = parseInt(params.id);

  // Find the parent photo and check if this is the active generation
  const { rows: spRows } = await pool.query(
    `SELECT photo_id FROM car_showroom_photos WHERE id = $1`,
    [showroomId]
  );
  const photoId: number | undefined = spRows[0]?.photo_id;

  await pool.query(`DELETE FROM car_showroom_photos WHERE id = $1`, [showroomId]);

  if (photoId) {
    // If deleted row was active, find next latest complete generation or clear active
    const { rows: photoRows } = await pool.query(
      `SELECT active_showroom_id FROM car_photos WHERE id = $1`,
      [photoId]
    );
    if (photoRows[0]?.active_showroom_id === showroomId) {
      const { rows: latest } = await pool.query(
        `SELECT id FROM car_showroom_photos WHERE photo_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
        [photoId]
      );
      await pool.query(
        `UPDATE car_photos SET active_showroom_id = $1 WHERE id = $2`,
        [latest[0]?.id ?? null, photoId]
      );
    }
  }

  return NextResponse.json({ ok: true });
}
