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

  const id = parseInt(params.id);
  const [listing, publications] = await Promise.all([
    pool.query(
      `SELECT cl.*, i.car_name, i.reg, i.colour, i.mileage_bought
       FROM car_listings cl JOIN inventory i ON i.id = cl.inventory_id
       WHERE cl.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT * FROM listing_publications WHERE listing_id = $1`,
      [id]
    ),
  ]);

  if (!listing.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get photos
  const selectedIds: number[] | null = listing.rows[0].selected_photo_ids;
  let photos: unknown[] = [];
  if (selectedIds && selectedIds.length > 0) {
    const { rows } = await pool.query(
      `SELECT * FROM car_photos WHERE id = ANY($1::int[])`,
      [selectedIds]
    );
    photos = rows;
  }

  return NextResponse.json({
    listing: listing.rows[0],
    publications: publications.rows,
    photos,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);
  const body = await req.json();

  const allowed = ["title", "description", "price", "selected_photo_ids", "status"];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx++}`);
      vals.push(key === "price" ? parseFloat(body[key]) : body[key]);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE car_listings SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
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

  await pool.query(
    `UPDATE car_listings SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [parseInt(params.id)]
  );
  return NextResponse.json({ ok: true });
}
