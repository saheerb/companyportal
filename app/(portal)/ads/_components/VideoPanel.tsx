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
  active_file_path?: string | null;
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

function proxyUrl(src: string, width?: number): string {
  if (src.startsWith("https://storage.googleapis.com/")) {
    const w = width ? `&w=${width}` : "";
    return `/api/proxy-image?url=${encodeURIComponent(src)}${w}`;
  }
  return src;
}

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
  const [photoId, setPhotoId] = useState<number | null>(null);
  const [duration, setDuration] = useState<5 | 8>(5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStudio, setShowStudio] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadJobs() {
    const res = await fetch(`/api/video-jobs?inventory_id=${inventoryId}`);
    const data = await res.json() as VideoJob[];
    setJobs(data);
  }

  useEffect(() => {
    loadJobs();
  }, [inventoryId]);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setShowStudio(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          photo_id: photoId ?? undefined,
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

  const selectedPhoto = photos.find(p => p.id === photoId) ?? null;

  return (
    <>
      {/* Inline section: summary + open button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            {jobs.length === 0
              ? "No videos generated yet."
              : `${jobs.length} video${jobs.length > 1 ? "s" : ""} generated.`}
            {jobs.some(j => j.status === "pending" || j.status === "processing") && (
              <span className="ml-2 text-blue-500 inline-flex items-center gap-1">
                <span className="animate-spin inline-block w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
                Generating…
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowStudio(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          Video Studio
        </button>
      </div>

      {/* Recent complete videos inline */}
      {jobs.filter(j => j.status === "complete" && j.file_path).slice(0, 2).map(job => (
        <div key={job.id} className="border rounded-lg overflow-hidden mt-3">
          <video src={job.file_path!} controls className="w-full max-h-64 bg-black" />
          <div className="px-3 py-2 bg-gray-50 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 truncate flex-1">{job.prompt}</p>
            <a href={job.file_path!} download target="_blank" rel="noreferrer"
              className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 flex-shrink-0">
              Download
            </a>
          </div>
        </div>
      ))}

      {/* Fullscreen Video Studio modal */}
      {showStudio && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 h-12 bg-gray-900 border-b border-white/10 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <span className="text-white font-medium text-sm">Video Studio</span>
            <span className="text-white/40 text-xs">{carName}</span>
            <div className="flex-1" />
            <button
              onClick={() => setShowStudio(false)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

              {/* Photo selection */}
              {photos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                    Reference Photo <span className="normal-case font-normal text-white/30">(optional — Veo will animate it)</span>
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {/* None option */}
                    <button
                      onClick={() => setPhotoId(null)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex items-center justify-center transition-all ${
                        photoId === null ? "border-purple-500 bg-purple-900/30" : "border-white/15 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <span className="text-xs text-white/50">None</span>
                    </button>
                    {photos.map((photo, idx) => {
                      const thumbSrc = photo.active_file_path ?? photo.file_path;
                      const isSelected = photo.id === photoId;
                      return (
                        <div
                          key={photo.id}
                          onClick={() => setPhotoId(isSelected ? null : photo.id)}
                          className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            isSelected ? "border-purple-500 shadow-lg shadow-purple-500/30" : "border-white/15 hover:border-white/40"
                          }`}
                        >
                          <img src={proxyUrl(thumbSrc, 200)} alt="" className="w-full h-full object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 text-center text-white text-[9px] bg-black/50 py-0.5">
                            {photo.label ?? `Photo ${idx + 1}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedPhoto && (
                    <p className="text-xs text-purple-400 mt-2">
                      Using: {selectedPhoto.label ?? `Photo ${photos.indexOf(selectedPhoto) + 1}`}
                    </p>
                  )}
                </div>
              )}

              {/* Prompt */}
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  placeholder="Describe the video you want to generate…"
                />
              </div>

              {/* Duration + actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Duration</p>
                  <div className="flex gap-1">
                    {([5, 8] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                          duration === d ? "bg-white text-gray-900 border-white" : "border-white/20 text-white/70 hover:border-white/40"
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1" />

                <div className="flex gap-2 items-end">
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={generating || !prompt.trim()}
                    className="px-3 py-2 text-sm border border-white/20 text-white/70 rounded hover:bg-white/10 disabled:opacity-40 whitespace-nowrap"
                    title="Creates a job with a sample video instantly — no API call, no cost"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleGenerate(false)}
                    disabled={generating || !prompt.trim()}
                    className="px-5 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40 font-medium whitespace-nowrap"
                  >
                    {generating ? "Starting…" : "Generate Video"}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              <p className="text-xs text-white/30">Videos take 1–3 minutes to generate. ~$1.75 per 5s clip.</p>

              {/* Jobs list */}
              {jobs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wide">Generated Videos</p>
                  {jobs.map(job => (
                    <div key={job.id} className="border border-white/10 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 bg-white/5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status] ?? STATUS_COLORS.pending}`}>
                          {job.status === "processing" ? (
                            <span className="flex items-center gap-1">
                              <span className="animate-spin inline-block w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
                              generating…
                            </span>
                          ) : job.status}
                        </span>
                        <span className="text-xs text-white/40">{job.duration_seconds}s</span>
                        <span className="flex-1 text-xs text-white/60 truncate">{job.prompt}</span>
                        <span className="text-xs text-white/30">
                          {new Date(job.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {job.status === "complete" && job.file_path && (
                          <a href={job.file_path} download target="_blank" rel="noreferrer"
                            className="text-xs px-2 py-1 bg-white/10 text-white rounded hover:bg-white/20 flex-shrink-0">
                            Download
                          </a>
                        )}
                      </div>
                      {job.status === "complete" && job.file_path && (
                        <video src={job.file_path} controls className="w-full max-h-80 bg-black" />
                      )}
                      {job.status === "failed" && job.error && (
                        <p className="px-4 py-2 text-xs text-red-400 bg-red-950/30">{job.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
