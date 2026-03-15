import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`(name ILIKE $${idx} OR reg ILIKE $${idx} OR email ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }
  if (status) {
    conditions.push(`status = $${idx}`);
    values.push(status);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT * FROM leads ${where} ORDER BY created_at DESC`,
    values
  );

  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, log_add, log_edit, log_delete, ...fields } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Activity log operations
  if (log_add || log_edit || log_delete) {
    const { rows } = await pool.query(`SELECT activity_log FROM leads WHERE id = $1`, [id]);
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    let log: { id: string; ts: string; msg: string; note?: string }[] = [];
    try { log = JSON.parse(rows[0].activity_log || "[]"); } catch { log = []; }

    if (log_add) {
      log.push({ id: randomUUID(), ts: new Date().toISOString(), msg: log_add.msg, note: log_add.note });
    }
    if (log_edit) {
      const entry = log.find((e) => e.id === log_edit.id);
      if (entry) { entry.msg = log_edit.msg; entry.note = log_edit.note; }
    }
    if (log_delete) {
      log = log.filter((e) => e.id !== log_delete);
    }

    const { rows: updated } = await pool.query(
      `UPDATE leads SET activity_log = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(log), id]
    );
    return NextResponse.json(updated[0]);
  }

  // Field updates
  const allowed = [
    "status", "notes", "offered_price", "autotrader_price",
    "motors_price", "wbac_price", "scrap_price", "address",
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) { sets.push(`${key} = $${idx++}`); vals.push(fields[key]); }
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE leads SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return NextResponse.json(rows[0]);
}
