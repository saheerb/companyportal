import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inventoryId = req.nextUrl.searchParams.get("inventory_id");
  const status = req.nextUrl.searchParams.get("status");

  let query = `
    SELECT cl.*, i.car_name, i.reg,
      (SELECT json_agg(lp.*) FROM listing_publications lp WHERE lp.listing_id = cl.id) AS publications
    FROM car_listings cl
    JOIN inventory i ON i.id = cl.inventory_id
    WHERE cl.status != 'archived'
  `;
  const vals: unknown[] = [];
  let idx = 1;

  if (inventoryId) {
    query += ` AND cl.inventory_id = $${idx++}`;
    vals.push(parseInt(inventoryId));
  }
  if (status) {
    query += ` AND cl.status = $${idx++}`;
    vals.push(status);
  }

  query += ` ORDER BY cl.created_at DESC`;

  const { rows } = await pool.query(query, vals);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inventory_id, title, description, price, selected_photo_ids } = await req.json();
  if (!inventory_id || !title || !description || price == null) {
    return NextResponse.json({ error: "inventory_id, title, description and price required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO car_listings (inventory_id, title, description, price, selected_photo_ids, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      inventory_id,
      title,
      description,
      parseFloat(price),
      selected_photo_ids ?? null,
      session.user?.email ?? null,
    ]
  );
  return NextResponse.json(rows[0]);
}
