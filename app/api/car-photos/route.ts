import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inventoryId = req.nextUrl.searchParams.get("inventory_id");
  if (!inventoryId) return NextResponse.json({ error: "inventory_id required" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT cp.*,
       csp.file_path AS active_file_path,
       csp.scene_id  AS active_scene_id
     FROM car_photos cp
     LEFT JOIN car_showroom_photos csp ON csp.id = cp.active_showroom_id
     WHERE cp.inventory_id = $1
     ORDER BY cp.sort_order ASC, cp.created_at ASC`,
    [parseInt(inventoryId)]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inventory_id, file_path, label } = await req.json();
  if (!inventory_id || !file_path) {
    return NextResponse.json({ error: "inventory_id and file_path required" }, { status: 400 });
  }

  // Get next sort_order
  const { rows: existing } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM car_photos WHERE inventory_id = $1`,
    [inventory_id]
  );
  const sort_order = existing[0]?.next_order ?? 0;

  const { rows } = await pool.query(
    `INSERT INTO car_photos (inventory_id, file_path, label, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [inventory_id, file_path, label ?? null, sort_order, session.user?.email ?? null]
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await pool.query(`DELETE FROM car_photos WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
