import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import https from "https";
import http from "http";
import { fetchFileAsBuffer, uploadToGCS } from "@/lib/google-storage";

const REPLICATE_BG_REMOVAL_VERSION =
  "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";

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

async function runBgRemoval(jobId: number, photoId: number, filePath: string) {
  try {
    // Mark processing
    await pool.query(
      `UPDATE ai_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [jobId]
    );
    await pool.query(
      `UPDATE car_photos SET processing_status = 'processing' WHERE id = $1`,
      [photoId]
    );

    // Read file as base64
    const { buffer: fileBuffer, mimeType: mime } = await fetchFileAsBuffer(filePath);
    const base64 = `data:${mime};base64,${fileBuffer.toString("base64")}`;

    // Call Replicate
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_BG_REMOVAL_VERSION,
        input: { image: base64 },
      }),
    });
    const prediction = await createRes.json() as { id: string; status: string; output?: string; error?: string };

    await pool.query(
      `UPDATE ai_jobs SET replicate_prediction_id = $1, updated_at = NOW() WHERE id = $2`,
      [prediction.id, jobId]
    );

    // Poll until done
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed" && result.status !== "canceled") {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
      });
      result = await pollRes.json() as typeof prediction;
    }

    if (result.status === "succeeded" && result.output) {
      // Download the processed image and upload to Google Drive
      const outputBuffer = await downloadFile(result.output);
      const outputFilename = `${photoId}_nobg.png`;
      const processedPath = await uploadToGCS(outputBuffer, outputFilename, "image/png");

      await pool.query(
        `UPDATE car_photos SET processed_path = $1, processing_status = 'complete' WHERE id = $2`,
        [processedPath, photoId]
      );
      await pool.query(
        `UPDATE ai_jobs SET status = 'complete', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [jobId]
      );
    } else {
      const errMsg = result.error ?? "Replicate job failed";
      await pool.query(
        `UPDATE car_photos SET processing_status = 'failed', processing_error = $1 WHERE id = $2`,
        [errMsg, photoId]
      );
      await pool.query(
        `UPDATE ai_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [errMsg, jobId]
      );
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE car_photos SET processing_status = 'failed', processing_error = $1 WHERE id = $2`,
      [errMsg, photoId]
    );
    await pool.query(
      `UPDATE ai_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [errMsg, jobId]
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN not configured" }, { status: 500 });
  }

  const { photo_id } = await req.json();
  if (!photo_id) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  // Get photo
  const { rows: photos } = await pool.query(
    `SELECT * FROM car_photos WHERE id = $1`,
    [photo_id]
  );
  if (!photos[0]) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  const photo = photos[0] as { id: number; file_path: string };

  // Create job row
  const { rows: jobs } = await pool.query(
    `INSERT INTO ai_jobs (photo_id, job_type, status) VALUES ($1, 'bg_removal', 'queued') RETURNING *`,
    [photo_id]
  );
  const job = jobs[0] as { id: number };

  // Update photo status
  await pool.query(
    `UPDATE car_photos SET processing_status = 'queued', processing_error = NULL WHERE id = $1`,
    [photo_id]
  );

  // Fire and forget
  runBgRemoval(job.id, photo.id, photo.file_path).catch(() => {});

  return NextResponse.json({ job_id: job.id });
}
