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

type BandEntry = { ageBand: string | null; mileageBand: string | null; ratio: number };

function computeOffer(
  auctionValue: number,
  currentAgeBand: string | null,
  currentMileageBand: string | null,
  entries: BandEntry[],
  fallbackRatio: number,
): { smartOffer: number; estimatedWbac: number; wbacRatio: number; confidence: "high" | "medium" | "low"; bandDataPoints: number; margin: number } | null {
  if (entries.length === 0) return null;

  const ageOrder = ["young", "mid", "old"];
  const mileageOrder = ["low", "mid", "high"];

  const exactRows = entries.filter(
    (r) => r.ageBand === currentAgeBand && r.mileageBand === currentMileageBand
  );
  if (exactRows.length >= 3) {
    const wbacRatio = medianRatio(exactRows.map((r) => r.ratio))!;
    const estimatedWbac = auctionValue * wbacRatio;
    return {
      smartOffer: Math.round(estimatedWbac + 150),
      estimatedWbac: Math.round(estimatedWbac),
      wbacRatio: Math.round(wbacRatio * 1000) / 1000,
      confidence: exactRows.length >= 5 ? "high" : "medium",
      bandDataPoints: exactRows.length,
      margin: 150,
    };
  }

  const ageIdx = ageOrder.indexOf(currentAgeBand ?? "");
  const mileageIdx = mileageOrder.indexOf(currentMileageBand ?? "");
  const adjAgeBands = ageOrder.filter((_, i) => Math.abs(i - ageIdx) <= 1);
  const adjMileageBands = mileageOrder.filter((_, i) => Math.abs(i - mileageIdx) <= 1);
  const expandedRows = entries.filter(
    (r) =>
      adjAgeBands.includes(r.ageBand ?? "") &&
      adjMileageBands.includes(r.mileageBand ?? "")
  );

  if (expandedRows.length >= 1) {
    const wbacRatio = medianRatio(expandedRows.map((r) => r.ratio))!;
    const estimatedWbac = auctionValue * wbacRatio;
    return {
      smartOffer: Math.round(estimatedWbac + 150),
      estimatedWbac: Math.round(estimatedWbac),
      wbacRatio: Math.round(wbacRatio * 1000) / 1000,
      confidence: "medium",
      bandDataPoints: expandedRows.length,
      margin: 150,
    };
  }

  const globalRatio = medianRatio(entries.map((r) => r.ratio)) ?? fallbackRatio;
  const estimatedWbac = auctionValue * globalRatio;
  return {
    smartOffer: Math.round(estimatedWbac + 150),
    estimatedWbac: Math.round(estimatedWbac),
    wbacRatio: Math.round(globalRatio * 1000) / 1000,
    confidence: "low",
    bandDataPoints: entries.length,
    margin: 150,
  };
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

  // Fetch all training rows: Source A (auction+wbac), Source B/C (autotrader+wbac), calibration (auction+autotrader)
  const { rows } = await pool.query(`
    SELECT auction_value, wbac_price, autotrader_price, mileage, reg
    FROM leads
    WHERE
      (auction_value IS NOT NULL AND wbac_price IS NOT NULL AND auction_value > 0)
      OR (autotrader_price IS NOT NULL AND wbac_price IS NOT NULL AND autotrader_price > 0)
      OR (auction_value IS NOT NULL AND autotrader_price IS NOT NULL AND auction_value > 0 AND autotrader_price > 0)
  `);

  const FALLBACK_RATIO = 0.88;

  // Source A: leads with auction_value + wbac_price
  const annotated: BandEntry[] = rows
    .filter((r) => r.auction_value != null && r.wbac_price != null && Number(r.auction_value) > 0)
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

  if (rows.length === 0 || annotated.length === 0) {
    return NextResponse.json({
      smartOffer: auctionValue,
      estimatedWbac: null,
      wbacRatio: null,
      confidence: "low",
      bandDataPoints: 0,
      ageBand: currentAgeBand,
      mileageBand: currentMileageBand,
      apiValue: auctionValue,
      margin: null,
    });
  }

  // Compute standard smart offer (Source A only)
  const standardResult = computeOffer(auctionValue, currentAgeBand, currentMileageBand, annotated, FALLBACK_RATIO)!;

  // Compute AutoTrader/auction calibration from leads with both fields
  const calibrationRatios = rows
    .filter((r) => r.auction_value != null && r.autotrader_price != null && Number(r.auction_value) > 0 && Number(r.autotrader_price) > 0)
    .map((r) => Number(r.autotrader_price) / Number(r.auction_value))
    .filter((v) => isFinite(v) && v > 0 && v < 3);

  const calibration = calibrationRatios.length >= 2 ? medianRatio(calibrationRatios) : null;

  // Build Source C bridge entries: autotrader+wbac but NO auction_value
  let enhancedSmartOffer: number | null = null;
  let calibrationDataPoints = 0;

  if (calibration != null) {
    const bridgeEntries: BandEntry[] = rows
      .filter(
        (r) =>
          r.autotrader_price != null &&
          r.wbac_price != null &&
          Number(r.autotrader_price) > 0 &&
          (r.auction_value == null || Number(r.auction_value) === 0)
      )
      .map((row) => {
        const rowYear = extractYearFromReg(row.reg || "");
        const rowAge = rowYear ? currentYear - rowYear : null;
        const syntheticRatio = (Number(row.wbac_price) / Number(row.autotrader_price)) * calibration;
        return {
          ageBand: getAgeBand(rowAge),
          mileageBand: getMileageBand(row.mileage ? Number(row.mileage) : null),
          ratio: syntheticRatio,
        };
      })
      .filter((r) => isFinite(r.ratio) && r.ratio > 0 && r.ratio < 2);

    calibrationDataPoints = bridgeEntries.length;

    if (bridgeEntries.length > 0) {
      const enhancedPool = [...annotated, ...bridgeEntries];
      const enhancedResult = computeOffer(auctionValue, currentAgeBand, currentMileageBand, enhancedPool, FALLBACK_RATIO);
      if (enhancedResult) enhancedSmartOffer = enhancedResult.smartOffer;
    }
  }

  return NextResponse.json({
    ...standardResult,
    ageBand: currentAgeBand,
    mileageBand: currentMileageBand,
    apiValue: auctionValue,
    ...(enhancedSmartOffer != null ? { enhancedSmartOffer, calibrationDataPoints } : {}),
  });
}
