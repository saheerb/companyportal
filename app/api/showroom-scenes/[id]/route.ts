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
  const allowed = ["label", "preview_emoji", "prompt_template", "background_path", "is_active", "sort_order"];
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
    `UPDATE showroom_scenes SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
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
    `UPDATE showroom_scenes SET is_active = FALSE WHERE id = $1`,
    [parseInt(params.id)]
  );
  return NextResponse.json({ ok: true });
}
