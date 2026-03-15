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
  const [car, finance, records] = await Promise.all([
    pool.query(
      `SELECT i.*, l.name AS lead_name, l.reg AS lead_reg
       FROM inventory i LEFT JOIN leads l ON l.id = i.lead_id
       WHERE i.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT * FROM finance_entries WHERE inventory_id = $1 ORDER BY entry_date DESC`,
      [id]
    ),
    pool.query(
      `SELECT * FROM official_records WHERE inventory_id = $1 ORDER BY created_at DESC`,
      [id]
    ),
  ]);

  if (!car.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalIncome = finance.rows
    .filter((r) => r.type === "income")
    .reduce((s: number, r) => s + parseFloat(r.amount), 0);
  const totalExpenses = finance.rows
    .filter((r) => r.type === "expense")
    .reduce((s: number, r) => s + parseFloat(r.amount), 0);

  return NextResponse.json({
    car: car.rows[0],
    finance: finance.rows,
    records: records.rows,
    profit: totalIncome - totalExpenses,
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

  const allowed = [
    "reg", "car_name", "colour", "mileage_bought", "purchase_price",
    "purchase_date", "status", "location", "notes", "lead_id",
  ];

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx++}`);
      vals.push(body[key]);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE inventory SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
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

  await pool.query(`DELETE FROM inventory WHERE id = $1`, [parseInt(params.id)]);
  return NextResponse.json({ ok: true });
}
