import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT * FROM showroom_scenes WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scene_key, label, preview_emoji, prompt_template } = await req.json();
  if (!scene_key || !label || !prompt_template) {
    return NextResponse.json({ error: "scene_key, label and prompt_template required" }, { status: 400 });
  }

  const { rows: existing } = await pool.query(
    `SELECT id FROM showroom_scenes ORDER BY sort_order DESC LIMIT 1`
  );
  const sort_order = existing[0] ? (parseInt(existing[0].sort_order) || 0) + 1 : 0;

  const { rows } = await pool.query(
    `INSERT INTO showroom_scenes (scene_key, label, preview_emoji, prompt_template, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [scene_key, label, preview_emoji ?? '🚗', prompt_template, sort_order]
  );
  return NextResponse.json(rows[0]);
}
