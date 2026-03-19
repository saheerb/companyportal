import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

function extractYearFromReg(reg: string): number | null {
  const match = reg.replace(/\s/g, "").toUpperCase().match(/^[A-Z]{2}(\d{2})[A-Z]{3}$/);
  if (!match) return null;
  const digits = parseInt(match[1], 10);
  if (digits >= 1 && digits <= 49) return 2000 + digits;
  if (digits >= 51 && digits <= 99) return 1950 + digits;
  return null;
}

function getAgeBand(age: number | null): string | null {
  if (age == null) return null;
  if (age <= 4) return "young";
  if (age <= 8) return "mid";
  return "old";
}

function getMileageBand(m: number | null): string | null {
  if (m == null) return null;
  if (m < 50000) return "low";
  if (m <= 100000) return "mid";
  return "high";
}

function medianRatio(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { rows: [lead] } = await pool.query(
    `SELECT id, reg, mileage, auction_value FROM leads WHERE id = $1`,
    [id]
  );
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.auction_value) return NextResponse.json({ error: "No auction value" }, { status: 400 });

  const auctionValue = Number(lead.auction_value);
  const currentYear = new Date().getFullYear();
  const carYear = extractYearFromReg(lead.reg || "");
  const ageYears = carYear ? currentYear - carYear : null;
  const currentAgeBand = getAgeBand(ageYears);
  const currentMileageBand = getMileageBand(lead.mileage ? Number(lead.mileage) : null);

  const { rows } = await pool.query(`
    SELECT auction_value, wbac_price, mileage, reg
    FROM leads
    WHERE auction_value IS NOT NULL AND wbac_price IS NOT NULL AND auction_value > 0
  `);

  const FALLBACK_RATIO = 0.88;

  if (rows.length === 0) {
    const estimatedWbac = auctionValue * FALLBACK_RATIO;
    return NextResponse.json({
      smartOffer: Math.round((estimatedWbac + 150) / 50) * 50,
      estimatedWbac: Math.round(estimatedWbac),
      wbacRatio: FALLBACK_RATIO,
      confidence: "low",
      bandDataPoints: 0,
      ageBand: currentAgeBand,
      mileageBand: currentMileageBand,
      apiValue: auctionValue,
      margin: 150,
    });
  }

  const annotated = rows
    .map((row) => {
      const rowYear = extractYearFromReg(row.reg || "");
      const rowAge = rowYear ? currentYear - rowYear : null;
      const ratio = Number(row.wbac_price) / Number(row.auction_value);
      return {
        ageBand: getAgeBand(rowAge),
        mileageBand: getMileageBand(row.mileage ? Number(row.mileage) : null),
        ratio,
      };
    })
    .filter((r) => isFinite(r.ratio) && r.ratio > 0 && r.ratio < 2);

  const ageOrder = ["young", "mid", "old"];
  const mileageOrder = ["low", "mid", "high"];

  // Exact band
  const exactRows = annotated.filter(
    (r) => r.ageBand === currentAgeBand && r.mileageBand === currentMileageBand
  );
  if (exactRows.length >= 3) {
    const wbacRatio = medianRatio(exactRows.map((r) => r.ratio))!;
    const estimatedWbac = auctionValue * wbacRatio;
    return NextResponse.json({
      smartOffer: Math.round((estimatedWbac + 150) / 50) * 50,
      estimatedWbac: Math.round(estimatedWbac),
      wbacRatio: Math.round(wbacRatio * 1000) / 1000,
      confidence: exactRows.length >= 5 ? "high" : "medium",
      bandDataPoints: exactRows.length,
      ageBand: currentAgeBand,
      mileageBand: currentMileageBand,
      apiValue: auctionValue,
      margin: 150,
    });
  }

  // Adjacent bands
  const ageIdx = ageOrder.indexOf(currentAgeBand ?? "");
  const mileageIdx = mileageOrder.indexOf(currentMileageBand ?? "");
  const adjAgeBands = ageOrder.filter((_, i) => Math.abs(i - ageIdx) <= 1);
  const adjMileageBands = mileageOrder.filter((_, i) => Math.abs(i - mileageIdx) <= 1);
  const expandedRows = annotated.filter(
    (r) =>
      adjAgeBands.includes(r.ageBand ?? "") &&
      adjMileageBands.includes(r.mileageBand ?? "")
  );

  if (expandedRows.length >= 1) {
    const wbacRatio = medianRatio(expandedRows.map((r) => r.ratio))!;
    const estimatedWbac = auctionValue * wbacRatio;
    return NextResponse.json({
      smartOffer: Math.round((estimatedWbac + 150) / 50) * 50,
      estimatedWbac: Math.round(estimatedWbac),
      wbacRatio: Math.round(wbacRatio * 1000) / 1000,
      confidence: "medium",
      bandDataPoints: expandedRows.length,
      ageBand: currentAgeBand,
      mileageBand: currentMileageBand,
      apiValue: auctionValue,
      margin: 150,
    });
  }

  // Global fallback
  const globalRatio = medianRatio(annotated.map((r) => r.ratio)) ?? FALLBACK_RATIO;
  const estimatedWbac = auctionValue * globalRatio;
  return NextResponse.json({
    smartOffer: Math.round((estimatedWbac + 150) / 50) * 50,
    estimatedWbac: Math.round(estimatedWbac),
    wbacRatio: Math.round(globalRatio * 1000) / 1000,
    confidence: "low",
    bandDataPoints: annotated.length,
    ageBand: currentAgeBand,
    mileageBand: currentMileageBand,
    apiValue: auctionValue,
    margin: 150,
  });
}
