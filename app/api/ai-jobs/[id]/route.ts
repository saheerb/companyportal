import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import path from "path";
import fs from "fs/promises";
import https from "https";
import http from "http";

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);
  const { rows } = await pool.query(`SELECT * FROM ai_jobs WHERE id = $1`, [id]);
  const job = rows[0] as {
    id: number;
    status: string;
    photo_id: number;
    replicate_prediction_id: string | null;
  } | undefined;

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If still in-flight and has a prediction ID, sync from Replicate
  if (
    (job.status === "queued" || job.status === "processing") &&
    job.replicate_prediction_id &&
    process.env.REPLICATE_API_TOKEN
  ) {
    try {
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${job.replicate_prediction_id}`,
        { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` } }
      );
      const prediction = await pollRes.json() as {
        status: string;
        output?: string;
        error?: string;
      };

      if (prediction.status === "succeeded" && prediction.output) {
        const outputBuffer = await downloadFile(prediction.output);
        const outputFilename = `${job.photo_id}_nobg.png`;
        const outputPath = path.join(process.cwd(), "public", "uploads", outputFilename);
        await fs.writeFile(outputPath, outputBuffer);
        const processedPath = `/uploads/${outputFilename}`;

        await pool.query(
          `UPDATE car_photos SET processed_path = $1, processing_status = 'complete' WHERE id = $2`,
          [processedPath, job.photo_id]
        );
        await pool.query(
          `UPDATE ai_jobs SET status = 'complete', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id]
        );
        const updated = await pool.query(`SELECT * FROM ai_jobs WHERE id = $1`, [id]);
        return NextResponse.json(updated.rows[0]);
      } else if (prediction.status === "failed" || prediction.status === "canceled") {
        const errMsg = prediction.error ?? "Replicate job failed";
        await pool.query(
          `UPDATE car_photos SET processing_status = 'failed', processing_error = $1 WHERE id = $2`,
          [errMsg, job.photo_id]
        );
        await pool.query(
          `UPDATE ai_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [errMsg, id]
        );
        const updated = await pool.query(`SELECT * FROM ai_jobs WHERE id = $1`, [id]);
        return NextResponse.json(updated.rows[0]);
      }
    } catch {
      // Return current state if sync fails
    }
  }

  // Also return the associated photo's current processing_status for convenience
  const { rows: photos } = await pool.query(
    `SELECT processing_status, processed_path FROM car_photos WHERE id = $1`,
    [job.photo_id]
  );

  return NextResponse.json({ ...rows[0], photo: photos[0] ?? null });
}
