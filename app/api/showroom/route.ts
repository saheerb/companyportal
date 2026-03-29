import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchFileAsBuffer, uploadToGCS } from "@/lib/google-storage";
import { logAiUsage } from "@/lib/ai-cost";

async function runShowroom(showroomId: number, photoFilePath: string, sceneId: string) {
  const { rows: sceneRows } = await pool.query(
    `SELECT * FROM showroom_scenes WHERE scene_key = $1 AND is_active = TRUE LIMIT 1`,
    [sceneId]
  );
  const scene = sceneRows[0];
  if (!scene) {
    await pool.query(
      `UPDATE car_showroom_photos SET status = 'failed', error = 'Unknown scene' WHERE id = $1`,
      [showroomId]
    );
    return;
  }

  try {
    await pool.query(
      `UPDATE car_showroom_photos SET status = 'processing' WHERE id = $1`,
      [showroomId]
    );

    // Fetch car photo
    const { buffer: fileBuffer, mimeType: mime } = await fetchFileAsBuffer(photoFilePath);
    const base64 = fileBuffer.toString("base64");

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
      // @ts-expect-error responseModalities is supported but not yet in SDK types
      generationConfig: { responseModalities: ["IMAGE"] },
    });

    // Build parts: if scene has a background image, include it as second inline data
    type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
    const parts: Part[] = [];

    if (scene.background_path) {
      const { buffer: bgBuffer, mimeType: bgMime } = await fetchFileAsBuffer(scene.background_path);
      parts.push({
        text: `Place the car from the first image into the background from the second image. Keep the car exactly the same — same position, same angle, same appearance. Blend lighting and shadows naturally. The car must remain the clear main subject.`,
      });
      parts.push({ inlineData: { mimeType: mime, data: base64 } });
      parts.push({ inlineData: { mimeType: bgMime, data: bgBuffer.toString("base64") } });
    } else {
      parts.push({ text: scene.prompt_template });
      parts.push({ inlineData: { mimeType: mime, data: base64 } });
    }

    const result = await model.generateContent(parts);
    const usage = result.response.usageMetadata;
    logAiUsage("showroom", "gemini-2.5-flash-image", usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0).catch(() => {});

    // Find image part in response
    const responseParts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find(
      (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.data
    ) as { inlineData: { mimeType: string; data: string } } | undefined;

    if (!imagePart) {
      throw new Error("Gemini returned no image");
    }

    // Upload output to Google Drive
    const outputExt = imagePart.inlineData.mimeType === "image/png" ? "png" : "jpg";
    const outputFilename = `showroom_${showroomId}_${sceneId}.${outputExt}`;
    const outputBuffer = Buffer.from(imagePart.inlineData.data, "base64");
    const driveUrl = await uploadToGCS(outputBuffer, outputFilename, imagePart.inlineData.mimeType);

    await pool.query(
      `UPDATE car_showroom_photos SET status = 'complete', file_path = $1 WHERE id = $2`,
      [driveUrl, showroomId]
    );
    // Auto-set this as the active version for the parent photo
    const { rows: spRows } = await pool.query(
      `SELECT photo_id FROM car_showroom_photos WHERE id = $1`,
      [showroomId]
    );
    if (spRows[0]) {
      await pool.query(
        `UPDATE car_photos SET active_showroom_id = $1 WHERE id = $2`,
        [showroomId, spRows[0].photo_id]
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE car_showroom_photos SET status = 'failed', error = $1 WHERE id = $2`,
      [msg, showroomId]
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photoId = req.nextUrl.searchParams.get("photo_id");
  if (!photoId) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT * FROM car_showroom_photos WHERE photo_id = $1 ORDER BY created_at DESC`,
    [parseInt(photoId)]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const { photo_id, scene_id } = await req.json() as { photo_id: number; scene_id: string };
  if (!photo_id || !scene_id) {
    return NextResponse.json({ error: "photo_id and scene_id required" }, { status: 400 });
  }
  const { rows: sceneCheck } = await pool.query(
    `SELECT id FROM showroom_scenes WHERE scene_key = $1 AND is_active = TRUE LIMIT 1`,
    [scene_id]
  );
  if (!sceneCheck[0]) {
    return NextResponse.json({ error: "Invalid scene_id" }, { status: 400 });
  }

  const { rows: photos } = await pool.query(
    `SELECT * FROM car_photos WHERE id = $1`,
    [photo_id]
  );
  if (!photos[0]) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const { rows } = await pool.query(
    `INSERT INTO car_showroom_photos (photo_id, scene_id) VALUES ($1, $2) RETURNING id`,
    [photo_id, scene_id]
  );
  const showroomId = rows[0].id;

  runShowroom(showroomId, photos[0].file_path, scene_id).catch(() => {});

  return NextResponse.json({ showroom_id: showroomId });
}
