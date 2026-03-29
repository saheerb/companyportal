import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(`SELECT * FROM dealer_settings ORDER BY id ASC LIMIT 1`);
  return NextResponse.json(rows[0] ?? null);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["dealer_name", "dealer_prompt", "dealer_blurbs", "badge_path", "car_slots", "dealer_slots"];
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

  const { rows } = await pool.query(
    `UPDATE dealer_settings SET ${sets.join(", ")} WHERE id = (SELECT id FROM dealer_settings ORDER BY id ASC LIMIT 1) RETURNING *`,
    vals
  );
  return NextResponse.json(rows[0]);
}
