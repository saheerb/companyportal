import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT * FROM receivables ORDER BY received ASC, due_date ASC NULLS LAST, created_at DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, amount, due_date, notes } = await req.json();
  if (!name || amount === undefined) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { rows } = await pool.query(
    `INSERT INTO receivables (name, description, amount, due_date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, description || null, amount, due_date || null, notes || null]
  );
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["name", "description", "amount", "due_date", "received", "received_date", "notes"];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) { sets.push(`${key} = $${idx++}`); vals.push(body[key]); }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE receivables SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await pool.query(`DELETE FROM receivables WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
