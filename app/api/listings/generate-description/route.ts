import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logAiUsage } from "@/lib/ai-cost";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const { inventory_id } = await req.json();
  if (!inventory_id) return NextResponse.json({ error: "inventory_id required" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT reg, car_name, colour, mileage_bought, purchase_price, use_cases FROM inventory WHERE id = $1`,
    [inventory_id]
  );
  const car = rows[0] as {
    reg: string;
    car_name: string | null;
    colour: string | null;
    mileage_bought: number | null;
    purchase_price: number | null;
    use_cases: string[] | null;
  } | undefined;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const carDesc = [
    car.car_name ?? "Car",
    car.colour ? `in ${car.colour}` : null,
    car.mileage_bought ? `with ${car.mileage_bought.toLocaleString()} miles` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const useCaseLine = car.use_cases?.length
    ? `\nThis car is ideal for: ${car.use_cases.join(", ")}.`
    : "";

  const prompt = `Write a compelling UK car dealership ad description for a ${carDesc}.${useCaseLine}
Keep it between 3-5 sentences. Highlight the condition, reliability, and value.
Use a friendly, professional tone suited for Facebook Marketplace and AutoTrader.
Do not include a price. Do not use emojis. Do not include the registration plate.`;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const result = await model.generateContent(prompt);
  const usage = result.response.usageMetadata;
  logAiUsage("listing_description", "gemini-2.5-flash-lite", usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0).catch(() => {});
  const description = result.response.text().trim();

  return NextResponse.json({ description });
}
