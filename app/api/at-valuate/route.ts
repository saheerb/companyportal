import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { rows: [lead] } = await pool.query(`SELECT reg, mileage FROM leads WHERE id = $1`, [id]);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.reg) return NextResponse.json({ error: "Lead has no registration" }, { status: 400 });

  const carhuntUrl = process.env.CARHUNT_URL;
  const carhuntSecret = process.env.CARHUNT_SECRET;
  if (!carhuntUrl || !carhuntSecret) {
    return NextResponse.json({ error: "Carhunt not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${carhuntUrl}/valuate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${carhuntSecret}`,
      },
      body: JSON.stringify({ reg: lead.reg, mileage: lead.mileage }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error || "Valuation failed" }, { status: res.status });

    // Save to lead record
    await pool.query(
      `UPDATE leads SET autotrader_retail_price = $1, autotrader_price = $2 WHERE id = $3`,
      [data.retail ?? null, data.trade ?? null, id]
    );

    return NextResponse.json({ retail: data.retail, trade: data.trade });
  } catch (err) {
    console.error("[at-valuate] error:", err);
    return NextResponse.json({ error: "Could not reach carhunt server" }, { status: 502 });
  }
}
