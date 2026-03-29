import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalRes, byOpRes, recentRes] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(cost_usd), 0) AS total_cost_usd FROM ai_usage_log`),
    pool.query(`
      SELECT
        operation,
        COUNT(*)::int AS count,
        COALESCE(SUM(input_tokens), 0)::int  AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COALESCE(SUM(cost_usd), 0)           AS cost_usd
      FROM ai_usage_log
      GROUP BY operation
      ORDER BY cost_usd DESC
    `),
    pool.query(`
      SELECT id, created_at, operation, model, input_tokens, output_tokens, cost_usd
      FROM ai_usage_log
      ORDER BY created_at DESC
      LIMIT 20
    `),
  ]);

  return NextResponse.json({
    total_cost_usd: parseFloat(totalRes.rows[0].total_cost_usd),
    by_operation: byOpRes.rows.map(r => ({ ...r, cost_usd: parseFloat(r.cost_usd) })),
    recent: recentRes.rows.map(r => ({ ...r, cost_usd: parseFloat(r.cost_usd) })),
  });
}
