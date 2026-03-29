import pool from "@/lib/db";

const RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash-lite":  { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  "gemini-2.5-flash-image": { input: 0.15  / 1_000_000, output: 0.60 / 1_000_000 },
  // For video: input = duration in seconds, rate = $0.35/sec
  "veo-2.0-generate-001":   { input: 0.35,               output: 0 },
};

export async function logAiUsage(
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const rate = RATES[model] ?? { input: 0, output: 0 };
    const cost = inputTokens * rate.input + outputTokens * rate.output;
    await pool.query(
      `INSERT INTO ai_usage_log (operation, model, input_tokens, output_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5)`,
      [operation, model, inputTokens, outputTokens, cost]
    );
  } catch {
    // Non-fatal — never block the main operation
  }
}
