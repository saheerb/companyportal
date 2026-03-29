import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logAiUsage } from "@/lib/ai-cost";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const { rows: settingsRows } = await pool.query(
    `SELECT * FROM dealer_settings ORDER BY id ASC LIMIT 1`
  );
  const settings = settingsRows[0];
  if (!settings) return NextResponse.json({ error: "Dealer settings not found" }, { status: 404 });

  const count = settings.dealer_slots ?? 3;
  const dealerContext = settings.dealer_prompt?.trim();
  const prompt = `You are a car dealership marketing expert. Generate ${count} short, punchy dealer taglines for "${settings.dealer_name}".
${dealerContext ? `Use this information about the dealership as inspiration:\n${dealerContext}\n` : ""}
Rules:
- Each tagline is 4-8 words max
- Punchy, benefit-focused, suitable for overlaying on a car photo banner
- Return ONLY a JSON array of exactly ${count} strings, nothing else
Example: ["Your trusted local dealer", "Quality cars, honest prices"]`;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const result = await model.generateContent(prompt);
  const usage = result.response.usageMetadata;
  logAiUsage("dealer_blurbs", "gemini-2.5-flash-lite", usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0).catch(() => {});
  const text = result.response.text().trim();
  console.log("[generate-blurbs] raw text:", JSON.stringify(text));

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
  console.log("[generate-blurbs] parsed blurbs:", blurbs);

  const { rows } = await pool.query(
    `UPDATE dealer_settings SET dealer_blurbs = $1 WHERE id = (SELECT id FROM dealer_settings ORDER BY id ASC LIMIT 1) RETURNING *`,
    [blurbs]
  );
  return NextResponse.json(rows[0]);
}
