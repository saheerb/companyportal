import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [bankLatest, bankHistory, investments, stock, finance] = await Promise.all([
    pool.query(`SELECT * FROM bank_balances ORDER BY balance_date DESC LIMIT 1`),
    pool.query(`SELECT * FROM bank_balances ORDER BY balance_date DESC`),
    pool.query(`SELECT * FROM investments ORDER BY investment_date DESC`),
    pool.query(`
      SELECT
        COALESCE(SUM(purchase_price), 0) AS stock_value,
        COUNT(*) AS cars_in_stock
      FROM inventory WHERE status != 'Sold'
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses
      FROM finance_entries
    `),
  ]);

  const capitalInvested = investments.rows.reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);

  return NextResponse.json({
    bank_balance: bankLatest.rows[0] ?? null,
    bank_history: bankHistory.rows,
    investments: investments.rows,
    capital_invested: capitalInvested,
    stock_value: Number(stock.rows[0].stock_value),
    cars_in_stock: Number(stock.rows[0].cars_in_stock),
    total_income: Number(finance.rows[0].total_income),
    total_expenses: Number(finance.rows[0].total_expenses),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { entity } = body;

  if (entity === "bank") {
    const { bank_name, balance, balance_date } = body;
    if (!bank_name || balance === undefined || !balance_date)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const { rows } = await pool.query(
      `INSERT INTO bank_balances (bank_name, balance, balance_date) VALUES ($1,$2,$3) RETURNING *`,
      [bank_name, balance, balance_date]
    );
    return NextResponse.json(rows[0], { status: 201 });
  }

  if (entity === "investment") {
    const { name, type, amount, investment_date, notes } = body;
    if (!name || !type || amount === undefined || !investment_date)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const { rows } = await pool.query(
      `INSERT INTO investments (name, type, amount, investment_date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, type, amount, investment_date, notes || null]
    );
    return NextResponse.json(rows[0], { status: 201 });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entity, id } = await req.json();

  if (entity === "bank") {
    await pool.query(`DELETE FROM bank_balances WHERE id = $1`, [id]);
  } else if (entity === "investment") {
    await pool.query(`DELETE FROM investments WHERE id = $1`, [id]);
  } else {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
