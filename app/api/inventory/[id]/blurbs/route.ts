import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logAiUsage } from "@/lib/ai-cost";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const inventoryId = parseInt(params.id);
  const [{ rows }, { rows: settingsRows }, { rows: listingRows }] = await Promise.all([
    pool.query(`SELECT * FROM inventory WHERE id = $1`, [inventoryId]),
    pool.query(`SELECT car_slots FROM dealer_settings ORDER BY id ASC LIMIT 1`),
    pool.query(`SELECT price FROM car_listings WHERE inventory_id = $1 ORDER BY id DESC LIMIT 1`, [inventoryId]),
  ]);
  const car = rows[0];
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const count = settingsRows[0]?.car_slots ?? 5;
  const useCases: string[] = car.use_cases ?? [];
  const sellingPrice = listingRows[0]?.price;
  const priceStr = sellingPrice ? `£${Number(sellingPrice).toLocaleString()}` : null;

  const prompt = `You are a car sales copywriter. Generate ${count} short, punchy marketing blurbs for this car that can be overlaid on a photo.

Car: ${car.car_name ?? car.reg}
Colour: ${car.colour ?? "unknown"}
Mileage: ${car.mileage_bought ? `${car.mileage_bought.toLocaleString()} miles` : "unknown"}
${priceStr ? `Price: ${priceStr}` : ""}
${useCases.length > 0 ? `Vehicle use cases / target buyers: ${useCases.join(", ")}` : ""}

Rules:
- Each blurb is 4-8 words max
- Punchy, benefit-focused, no fluff
- Mix blurbs: some highlight price/value, some the car model, some the use cases (e.g. "Perfect family SUV", "Uber-ready, low miles")
- Suitable for overlaying on a car photo in bold white text
- Return ONLY a JSON array of exactly ${count} strings, nothing else
Example: ["Low mileage, big savings", "Perfect family runabout", "PCO-ready and priced to sell"]`;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const result = await model.generateContent(prompt);
  const usage = result.response.usageMetadata;
  logAiUsage("car_blurbs", "gemini-2.5-flash-lite", usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0).catch(() => {});
  const text = result.response.text().trim();

  let blurbs: string[] = [];
  try {
    const stripped = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    blurbs = match ? JSON.parse(match[0]) : [];
  } catch {
    blurbs = text
      .split("\n")
      .map(l => l.replace(/^```[a-z]*/i, "").replace(/```/, "").replace(/^[-•*\d."]+\s*/, "").replace(/[",\[\]]/g, "").trim())
      .filter(Boolean);
  }
  blurbs = blurbs.slice(0, count);

  const { rows: updated } = await pool.query(
    `UPDATE inventory SET car_blurbs = $1, updated_at = NOW() WHERE id = $2 RETURNING car_blurbs`,
    [blurbs, parseInt(params.id)]
  );
  return NextResponse.json({ car_blurbs: updated[0].car_blurbs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { car_blurbs } = await req.json();
  if (!Array.isArray(car_blurbs)) {
    return NextResponse.json({ error: "car_blurbs must be an array" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `UPDATE inventory SET car_blurbs = $1, updated_at = NOW() WHERE id = $2 RETURNING car_blurbs`,
    [car_blurbs, parseInt(params.id)]
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ car_blurbs: rows[0].car_blurbs });
}
