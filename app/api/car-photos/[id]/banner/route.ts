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

  const photoId = parseInt(params.id);
  const { file_path } = await req.json() as { file_path: string };
  if (!file_path) return NextResponse.json({ error: "file_path required" }, { status: 400 });

  const { rows } = await pool.query(
    `INSERT INTO car_showroom_photos (photo_id, scene_id, file_path, status)
     VALUES ($1, 'banner', $2, 'complete') RETURNING id`,
    [photoId, file_path]
  );
  const showroomId = rows[0].id;

  await pool.query(
    `UPDATE car_photos SET active_showroom_id = $1 WHERE id = $2`,
    [showroomId, photoId]
  );

  return NextResponse.json({ showroom_id: showroomId });
}
