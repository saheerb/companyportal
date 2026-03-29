import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);

  await pool.query(
    `UPDATE listing_publications SET status = 'removed' WHERE listing_id = $1`,
    [id]
  );
  await pool.query(
    `UPDATE car_listings SET status = 'paused', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return NextResponse.json({ ok: true });
}
