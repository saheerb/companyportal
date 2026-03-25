import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const inventory_id = searchParams.get("inventory_id");
  const type = searchParams.get("type");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (inventory_id) { conditions.push(`f.inventory_id = $${idx++}`); values.push(inventory_id); }
  if (type) { conditions.push(`f.type = $${idx++}`); values.push(type); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT f.*, i.reg AS car_reg, i.car_name
     FROM finance_entries f
     LEFT JOIN inventory i ON i.id = f.inventory_id
     ${where}
     ORDER BY f.entry_date DESC, f.created_at DESC`,
    values
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, category, description, amount, entry_date, inventory_id, lead_id, notes, vat_claimable, off_the_records } = body;

  if (!type || !category || !description || amount === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO finance_entries (type, category, description, amount, entry_date, inventory_id, lead_id, notes, vat_claimable, off_the_records, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [type, category, description, amount, entry_date || new Date().toISOString().slice(0, 10),
     inventory_id || null, lead_id || null, notes, vat_claimable || false, off_the_records || false, session.user?.name ?? null]
  );
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["type", "category", "description", "amount", "entry_date", "inventory_id", "lead_id", "notes", "vat_claimable", "off_the_records"];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) { sets.push(`${key} = $${idx++}`); vals.push(fields[key]); }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE finance_entries SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await pool.query(`DELETE FROM finance_entries WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
