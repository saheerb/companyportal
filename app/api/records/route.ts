import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const inventory_id = searchParams.get("inventory_id");
  const investment_id = searchParams.get("investment_id");
  const doc_type = searchParams.get("doc_type");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (inventory_id) { conditions.push(`r.inventory_id = $${idx++}`); values.push(inventory_id); }
  if (investment_id) { conditions.push(`r.investment_id = $${idx++}`); values.push(investment_id); }
  if (doc_type) { conditions.push(`r.doc_type = $${idx++}`); values.push(doc_type); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT r.*, i.reg AS car_reg, i.car_name, inv.name AS investment_name
     FROM official_records r
     LEFT JOIN inventory i ON i.id = r.inventory_id
     LEFT JOIN investments inv ON inv.id = r.investment_id
     ${where}
     ORDER BY COALESCE(r.record_date, r.created_at::date) DESC, r.created_at DESC`,
    values
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { doc_type, doc_label, inventory_id, investment_id, lead_id, file_path, storage_ref, notes, record_date, created_by_label } = body;

  if (!doc_type || !doc_label) {
    return NextResponse.json({ error: "doc_type and doc_label required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO official_records (doc_type, doc_label, inventory_id, investment_id, lead_id, file_path, storage_ref, notes, created_by, record_date, created_by_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [doc_type, doc_label, inventory_id || null, investment_id || null, lead_id || null,
     file_path || null, storage_ref || null, notes, session.user?.name ?? null,
     record_date || null, created_by_label || null]
  );
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["doc_type", "doc_label", "inventory_id", "investment_id", "lead_id", "file_path", "storage_ref", "notes"];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) { sets.push(`${key} = $${idx++}`); vals.push(fields[key]); }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE official_records SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await pool.query(`DELETE FROM official_records WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
