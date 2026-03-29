import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);
  const body = await req.json();

  const allowed = ["sort_order", "label", "active_showroom_id", "banner_blurb", "banner_show_badge"];
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

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE car_photos SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
