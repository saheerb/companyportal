"use client";

import { useEffect, useRef, useState } from "react";

type VideoJob = {
  id: number;
  created_at: string;
  inventory_id: number;
  prompt: string;
  photo_id: number | null;
  status: string;
  file_path: string | null;
  error: string | null;
  duration_seconds: number;
};

type Photo = {
  id: number;
  file_path: string;
  processed_path?: string | null;
  label: string | null;
  sort_order?: number;
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-gray-100 text-gray-500",
  processing: "bg-blue-100 text-blue-600",
  complete:   "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-600",
};

export default function VideoPanel({
  inventoryId,
  carName,
  photos,
}: {
  inventoryId: number;
  carName?: string;
  photos: Photo[];
}) {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [prompt, setPrompt] = useState(
    carName ? `Cinematic showcase of the ${carName} driving through scenic roads, dramatic lighting, smooth camera motion` : ""
  );
  const [photoId, setPhotoId] = useState<number | "">("");
  const [duration, setDuration] = useState<5 | 8>(5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadJobs() {
    const res = await fetch(`/api/video-jobs?inventory_id=${inventoryId}`);
    const data = await res.json() as VideoJob[];
    setJobs(data);
  }

  useEffect(() => {
    loadJobs();
  }, [inventoryId]);

  // Poll while any job is pending/processing
  useEffect(() => {
    const hasInProgress = jobs.some(j => j.status === "pending" || j.status === "processing");
    if (hasInProgress && !pollRef.current) {
      pollRef.current = setInterval(loadJobs, 5000);
    } else if (!hasInProgress && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [jobs]);

  async function handleGenerate(testMode = false) {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_id: inventoryId,
          prompt: prompt.trim(),
          photo_id: photoId || undefined,
          duration_seconds: duration,
          ...(testMode ? { test: true } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Failed to start video generation");
      }
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Generator form */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Describe the video you want to generate…"
          />
        </div>

        <div className="flex gap-4 items-end">
          {photos.length > 0 && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference photo (optional)</label>
              <select
                value={photoId}
                onChange={e => setPhotoId(e.target.value ? parseInt(e.target.value) : "")}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">None — text prompt only</option>
                {photos.map(p => (
                  <option key={p.id} value={p.id}>{p.label ?? `Photo ${p.id}`}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
            <div className="flex gap-1">
              {([5, 8] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-2 text-sm rounded border transition-colors ${
                    duration === d ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating || !prompt.trim()}
              className="px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
              title="Creates a job with a sample video instantly — no API call, no cost"
            >
              Test
            </button>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating || !prompt.trim()}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 font-medium whitespace-nowrap"
            >
              {generating ? "Starting…" : "Generate Video"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-gray-400">Videos take 1-3 minutes to generate. ~$1.75 per 5s clip.</p>
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Generated Videos</p>
          {jobs.map(job => (
            <div key={job.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status] ?? STATUS_COLORS.pending}`}>
                  {job.status === "processing" ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin inline-block w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
                      generating…
                    </span>
                  ) : job.status}
                </span>
                <span className="text-xs text-gray-500">{job.duration_seconds}s</span>
                <span className="flex-1 text-xs text-gray-600 truncate">{job.prompt}</span>
                <span className="text-xs text-gray-400">
                  {new Date(job.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {job.status === "complete" && job.file_path && (
                  <a
                    href={job.file_path}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700"
                  >
                    Download
                  </a>
                )}
              </div>
              {job.status === "complete" && job.file_path && (
                <video
                  src={job.file_path}
                  controls
                  className="w-full max-h-80 bg-black"
                />
              )}
              {job.status === "failed" && job.error && (
                <p className="px-4 py-2 text-xs text-red-600 bg-red-50">{job.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
