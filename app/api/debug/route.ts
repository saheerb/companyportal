import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  if (process.env.DEBUG_AUTH !== "true") {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }

  const result: Record<string, unknown> = {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.replace(/:\/\/.*@/, "://***@") + ")" : "MISSING",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "MISSING",
      NODE_ENV: process.env.NODE_ENV,
    },
    db: { status: "untested" as unknown },
    users: [] as unknown,
  };

  try {
    await pool.query("SELECT 1");
    result.db = { status: "connected" };
  } catch (err) {
    result.db = { status: "failed", error: (err as Error).message };
    return NextResponse.json(result);
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, username, (password_hash IS NOT NULL) AS has_password, google_email FROM users"
    );
    result.users = rows;
  } catch (err) {
    result.users = { error: (err as Error).message };
  }

  return NextResponse.json(result);
}
