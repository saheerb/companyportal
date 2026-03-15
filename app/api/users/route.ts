import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT id, username, google_email, created_by, created_at FROM users ORDER BY created_at DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, google_email } = await req.json();
  if (!username && !google_email) {
    return NextResponse.json({ error: "username or google_email required" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, google_email, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, username, google_email, created_by, created_at`,
      [username ?? google_email, google_email ?? null, session.user?.name ?? null]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      return NextResponse.json({ error: "That username or Google email already exists." }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
