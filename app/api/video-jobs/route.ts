import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { fetchFileAsBuffer, uploadToGCS } from "@/lib/google-storage";
import { logAiUsage } from "@/lib/ai-cost";

const VEO_API = "https://generativelanguage.googleapis.com/v1beta";

async function runVideoJob(jobId: number) {
  const { rows } = await pool.query(
    `SELECT vj.*, cp.file_path AS photo_file_path
     FROM video_jobs vj
     LEFT JOIN car_photos cp ON cp.id = vj.photo_id
     WHERE vj.id = $1`,
    [jobId]
  );
  const job = rows[0];
  if (!job) return;

  const apiKey = process.env.GOOGLE_AI_API_KEY!;

  try {
    // Build Veo request
    type VeoInstance = { prompt: string; image?: { bytesBase64Encoded: string; mimeType: string } };
    const instance: VeoInstance = { prompt: job.prompt };

    if (job.photo_file_path) {
      try {
        const { buffer, mimeType } = await fetchFileAsBuffer(job.photo_file_path);
        instance.image = { bytesBase64Encoded: buffer.toString("base64"), mimeType };
      } catch {
        // continue without photo
      }
    }

    const startRes = await fetch(
      `${VEO_API}/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [instance],
          parameters: { sampleCount: 1, durationSeconds: job.duration_seconds, aspectRatio: "16:9" },
        }),
      }
    );

    if (!startRes.ok) {
      const err = await startRes.text();
      throw new Error(`Veo start failed: ${err}`);
    }

    const startData = await startRes.json() as { name?: string };
    const operationName = startData.name;
    if (!operationName) throw new Error("No operation name returned from Veo");

    await pool.query(
      `UPDATE video_jobs SET operation_name = $1, status = 'processing' WHERE id = $2`,
      [operationName, jobId]
    );

    // Poll until done (max 10 min = 120 × 5s)
    let done = false;
    let attempts = 0;
    let videoUri: string | null = null;
    let videoMime = "video/mp4";

    while (!done && attempts < 120) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const pollRes = await fetch(`${VEO_API}/${operationName}?key=${apiKey}`);
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json() as {
        done?: boolean;
        response?: { videos?: { video?: { uri?: string; mimeType?: string } }[] };
        error?: { message: string };
      };

      if (pollData.error) throw new Error(pollData.error.message);

      if (pollData.done) {
        done = true;
        const videos = pollData.response?.videos ?? [];
        videoUri = videos[0]?.video?.uri ?? null;
        videoMime = videos[0]?.video?.mimeType ?? "video/mp4";
      }
    }

    if (!videoUri) throw new Error("Video generation timed out or returned no URI");

    // Fetch video bytes and upload to GCS
    const videoRes = await fetch(`${videoUri}?key=${apiKey}`);
    if (!videoRes.ok) throw new Error("Failed to download video from Veo");
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const ext = videoMime === "video/webm" ? "webm" : "mp4";
    const filename = `video_${jobId}_${Date.now()}.${ext}`;
    const gcsUrl = await uploadToGCS(videoBuffer, filename, videoMime);

    await pool.query(
      `UPDATE video_jobs SET status = 'complete', file_path = $1 WHERE id = $2`,
      [gcsUrl, jobId]
    );

    await logAiUsage("video", "veo-2.0-generate-001", job.duration_seconds, 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE video_jobs SET status = 'failed', error = $1 WHERE id = $2`,
      [msg, jobId]
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inventoryId = req.nextUrl.searchParams.get("inventory_id");
  if (!inventoryId) return NextResponse.json({ error: "inventory_id required" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT * FROM video_jobs WHERE inventory_id = $1 ORDER BY created_at DESC`,
    [parseInt(inventoryId)]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const { inventory_id, prompt, photo_id, duration_seconds, test } = await req.json() as {
    inventory_id: number;
    prompt: string;
    photo_id?: number;
    duration_seconds?: number;
    test?: boolean;
  };

  if (!inventory_id || !prompt) {
    return NextResponse.json({ error: "inventory_id and prompt required" }, { status: 400 });
  }

  const duration = duration_seconds ?? 5;

  // Test mode: instantly complete with a sample video, no API call
  if (test) {
    const sampleUrl = "https://www.w3schools.com/html/mov_bbb.mp4";
    const { rows } = await pool.query(
      `INSERT INTO video_jobs (inventory_id, prompt, photo_id, duration_seconds, status, file_path)
       VALUES ($1, $2, $3, $4, 'complete', $5) RETURNING *`,
      [inventory_id, prompt, photo_id ?? null, duration, sampleUrl]
    );
    return NextResponse.json(rows[0]);
  }

  const { rows } = await pool.query(
    `INSERT INTO video_jobs (inventory_id, prompt, photo_id, duration_seconds)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [inventory_id, prompt, photo_id ?? null, duration]
  );
  const job = rows[0];

  runVideoJob(job.id).catch(() => {});

  return NextResponse.json(job);
}
