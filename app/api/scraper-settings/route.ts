import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

const DEFAULTS: Record<string, string> = {
  SCRAPE_SEARCH_URL: "",
  SCRAPE_POSTCODE: "CB19PB",
  SCRAPE_RADIUS: "40",
  SCRAPE_MAX_PAGES: "5",
  SCRAPE_MAX_PRICE: "12000",
  SCRAPE_MAX_MILEAGE: "60000",
  AUTOTRADER_EMAIL: "",
  AUTOTRADER_PASSWORD: "",
};

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();

  const { rows } = await pool.query(`SELECT key, value FROM app_settings`);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Merge with defaults so keys always exist
  const result = { ...DEFAULTS, ...stored };
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();

  const body = await req.json();
  const allowed = Object.keys(DEFAULTS);

  for (const key of allowed) {
    if (key in body) {
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(body[key])]
      );
    }
  }

  // Return updated settings
  const { rows } = await pool.query(`SELECT key, value FROM app_settings`);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json({ ...DEFAULTS, ...stored });
}
