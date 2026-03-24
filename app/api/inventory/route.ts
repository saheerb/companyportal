import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`i.status = $${idx++}`);
    values.push(status);
  }
  if (search) {
    conditions.push(`(i.reg ILIKE $${idx} OR i.car_name ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT i.*, l.name AS lead_name
     FROM inventory i
     LEFT JOIN leads l ON l.id = i.lead_id
     ${where}
     ORDER BY i.created_at DESC`,
    values
  );
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["reg", "car_name", "colour", "mileage_bought", "purchase_price", "purchase_date", "status", "location", "notes"];
  const numeric = new Set(["mileage_bought", "purchase_price"]);
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) {
      const val = numeric.has(key) && fields[key] === "" ? null : fields[key] || (fields[key] === "" ? null : fields[key]);
      sets.push(`${key} = $${idx++}`);
      vals.push(val);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE inventory SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    reg, car_name, colour, mileage_bought, purchase_price,
    purchase_date, status, location, notes, lead_id,
  } = body;

  if (!reg) return NextResponse.json({ error: "reg is required" }, { status: 400 });

  const { rows } = await pool.query(
    `INSERT INTO inventory (reg, car_name, colour, mileage_bought, purchase_price, purchase_date, status, location, notes, lead_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [reg, car_name, colour, mileage_bought || null, purchase_price || null,
     purchase_date || null, status || "Bought", location, notes, lead_id || null]
  );
  return NextResponse.json(rows[0], { status: 201 });
}
