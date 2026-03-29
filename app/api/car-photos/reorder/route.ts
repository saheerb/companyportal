import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderedIds } = await req.json() as { orderedIds: number[] };
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      pool.query(`UPDATE car_photos SET sort_order = $1 WHERE id = $2`, [index, id])
    )
  );
  return NextResponse.json({ ok: true });
}
