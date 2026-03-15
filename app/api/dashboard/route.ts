import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    leadsToday,
    pendingOffers,
    inventoryCount,
    monthFinance,
    inventoryPipeline,
    recentLeads,
    monthlyPL,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM leads WHERE created_at >= $1`, [today]),
    pool.query(`SELECT COUNT(*) FROM leads WHERE status = 'Offer Sent'`),
    pool.query(`SELECT COUNT(*) FROM inventory WHERE status != 'Sold'`),
    pool.query(
      `SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
       FROM finance_entries WHERE entry_date >= $1`,
      [firstOfMonth]
    ),
    pool.query(
      `SELECT status, COUNT(*) AS count FROM inventory GROUP BY status`
    ),
    pool.query(
      `SELECT id, name, reg, car_name, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5`
    ),
    pool.query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', entry_date), 'Mon YYYY') AS month,
        DATE_TRUNC('month', entry_date) AS month_start,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
       FROM finance_entries
       WHERE entry_date >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', entry_date)
       ORDER BY month_start DESC`
    ),
  ]);

  const income = parseFloat(monthFinance.rows[0]?.income ?? "0");
  const expenses = parseFloat(monthFinance.rows[0]?.expenses ?? "0");

  return NextResponse.json({
    leadsToday: parseInt(leadsToday.rows[0].count),
    pendingOffers: parseInt(pendingOffers.rows[0].count),
    inventoryCount: parseInt(inventoryCount.rows[0].count),
    monthIncome: income,
    monthExpenses: expenses,
    monthProfit: income - expenses,
    inventoryPipeline: inventoryPipeline.rows,
    recentLeads: recentLeads.rows,
    monthlyPL: monthlyPL.rows,
  });
}
