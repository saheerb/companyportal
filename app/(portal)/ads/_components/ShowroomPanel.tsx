"use client";

import { useEffect, useRef, useState } from "react";
import BannerComposer from "./BannerComposer";

type Photo = {
  id: number;
  file_path: string;
  processed_path: string | null;
  label: string | null;
  sort_order?: number;
};

type Scene = {
  id: number;
  scene_key: string;
  label: string;
  preview_emoji: string;
};

type ShowroomPhoto = {
  id: number;
  photo_id: number;
  scene_id: string;
  file_path: string | null;
  status: string;
  error: string | null;
};

// Shared SVG icons
const IconCompare = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/>
    <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconRegen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
    <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default function ShowroomPanel({
  photos,
  inventoryId,
  onAddShowroomPhoto,
}: {
  photos: Photo[];
  inventoryId?: number;
  onAddShowroomPhoto?: (filePath: string, label: string) => void;
}) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneKey, setSelectedSceneKey] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(photos[0]?.id ?? null);
  const [resultsMap, setResultsMap] = useState<Record<number, ShowroomPhoto>>({});
  const [carBlurbs, setCarBlurbs] = useState<string[]>([]);
  const [dealerBlurbs, setDealerBlurbs] = useState<string[]>([]);
  const [badgePath, setBadgePath] = useState<string | null>(null);
  const [bannerPhotoSrc, setBannerPhotoSrc] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const photoStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/showroom-scenes")
      .then(r => r.json())
      .then((data: Scene[]) => {
        setScenes(data);
        if (data.length > 0) setSelectedSceneKey(data[0].scene_key);
      });
  }, []);

  useEffect(() => {
    if (inventoryId) {
      fetch(`/api/inventory/${inventoryId}`)
        .then(r => r.json())
        .then(d => setCarBlurbs(d.car?.car_blurbs ?? []));
    }
    fetch("/api/dealer-settings")
      .then(r => r.json())
      .then(d => { setDealerBlurbs(d?.dealer_blurbs ?? []); setBadgePath(d?.badge_path ?? null); });
  }, [inventoryId]);

  useEffect(() => {
    if (photos.length > 0 && !selectedPhotoId) setSelectedPhotoId(photos[0].id);
  }, [photos]);

  useEffect(() => {
    if (!selectedSceneKey || photos.length === 0) return;
    setShowOriginal(false);
    loadResults();
  }, [selectedSceneKey, photos]);

  useEffect(() => {
    const hasInProgress = Object.values(resultsMap).some(
      r => r.status === "pending" || r.status === "processing"
    );
    if (hasInProgress && !pollRef.current) {
      pollRef.current = setInterval(loadResults, 3000);
    } else if (!hasInProgress && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [resultsMap]);

  // Scroll the photo strip to keep selected photo visible
  useEffect(() => {
    const strip = photoStripRef.current;
    if (!strip || selectedPhotoId === null) return;
    const btn = strip.querySelector(`[data-photoid="${selectedPhotoId}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedPhotoId]);

  async function loadResults() {
    if (!selectedSceneKey) return;
    const all = await Promise.all(
      photos.map(p =>
        fetch(`/api/showroom?photo_id=${p.id}`)
          .then(r => r.json() as Promise<ShowroomPhoto[]>)
          .then(data => data.find(sp => sp.scene_id === selectedSceneKey) ?? null)
      )
    );
    const map: Record<number, ShowroomPhoto> = {};
    all.forEach((r, i) => { if (r) map[photos[i].id] = r; });
    setResultsMap(map);
  }

  async function applyScene(photoId: number) {
    if (!selectedSceneKey) return;
    setResultsMap(prev => ({
      ...prev,
      [photoId]: { ...(prev[photoId] ?? { id: 0, photo_id: photoId, scene_id: selectedSceneKey!, file_path: null, error: null }), status: "pending" },
    }));
    await fetch("/api/showroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photoId, scene_id: selectedSceneKey }),
    });
    await loadResults();
  }

  async function handleSaveBanner(blob: Blob) {
    setSavingBanner(true);
    const form = new FormData();
    form.append("file", blob, "banner.jpg");
    if (inventoryId) form.append("inventory_id", String(inventoryId));
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json() as { path?: string };
    if (data.path) {
      onAddShowroomPhoto?.(data.path, "Banner");
      setBannerPhotoSrc(null);
    }
    setSavingBanner(false);
  }

  if (photos.length === 0) {
    return <p className="text-sm text-gray-400">No photos selected. Tick photos in the Photos section above first.</p>;
  }

  const selectedIdx = Math.max(0, photos.findIndex(p => p.id === selectedPhotoId));
  const selectedPhoto = photos[selectedIdx];
  const selectedResult = resultsMap[selectedPhoto.id] ?? null;
  const isComplete = selectedResult?.status === "complete" && !!selectedResult.file_path;
  const originalSrc = selectedPhoto.processed_path ?? selectedPhoto.file_path;
  const previewSrc = (isComplete && !showOriginal) ? selectedResult!.file_path! : originalSrc;
  const isGenerating = selectedResult?.status === "pending" || selectedResult?.status === "processing";

  function navigate(dir: 1 | -1) {
    const next = Math.max(0, Math.min(photos.length - 1, selectedIdx + dir));
    setSelectedPhotoId(photos[next].id);
    setShowOriginal(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) navigate(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  }

  async function deleteGenerated() {
    if (!selectedResult) return;
    if (!confirm("Delete this generated photo? The original will be shown instead.")) return;
    setDeletingId(selectedResult.id);
    await fetch(`/api/showroom/${selectedResult.id}`, { method: "DELETE" });
    setShowOriginal(false);
    await loadResults();
    setDeletingId(null);
  }

  return (
    <div className="space-y-3">

      {/* ── Scene selector (top) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {scenes.map(scene => {
          const isActive = selectedSceneKey === scene.scene_key;
          const doneCount = photos.filter(p =>
            resultsMap[p.id]?.status === "complete" && resultsMap[p.id]?.scene_id === scene.scene_key
          ).length;
          return (
            <button
              key={scene.scene_key}
              onClick={() => setSelectedSceneKey(scene.scene_key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {scene.preview_emoji} {scene.label}
              {doneCount > 0 && (
                <span className={`text-xs font-semibold ${isActive ? "text-green-400" : "text-green-600"}`}>
                  {doneCount}✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Full-width photo preview ── */}
      <div
        className="relative bg-gray-900 rounded-xl overflow-hidden"
        style={{ aspectRatio: "16/10" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="Preview" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            Select a photo below
          </div>
        )}

        {/* Left / Right navigation arrows */}
        {selectedIdx > 0 && (
          <button
            onClick={() => navigate(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/75 text-white rounded-full transition-colors"
          >
            <IconChevronLeft />
          </button>
        )}
        {selectedIdx < photos.length - 1 && (
          <button
            onClick={() => navigate(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/75 text-white rounded-full transition-colors"
          >
            <IconChevronRight />
          </button>
        )}

        {/* Top-right: compare + delete icons */}
        {isComplete && (
          <div className="absolute top-3 right-3 flex gap-1.5">
            <button
              onClick={() => setShowOriginal(v => !v)}
              className={`p-2 rounded-lg transition-colors ${showOriginal ? "bg-blue-600 text-white" : "bg-black/60 hover:bg-black/80 text-white"}`}
              title={showOriginal ? "Show generated" : "Compare with original"}
            >
              <IconCompare />
            </button>
            <button
              onClick={deleteGenerated}
              disabled={deletingId === selectedResult!.id}
              className="p-2 bg-black/60 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              title="Delete generated photo"
            >
              <IconTrash />
            </button>
          </div>
        )}

        {/* "Original" badge */}
        {showOriginal && isComplete && (
          <div className="absolute top-3 left-3 text-xs bg-blue-600 text-white px-2 py-1 rounded font-medium pointer-events-none">
            Original
          </div>
        )}

        {/* Generating overlay */}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin w-10 h-10 border-2 border-white border-t-transparent rounded-full" />
            <p className="text-white text-sm">Generating…</p>
          </div>
        )}

        {/* Failed error */}
        {selectedResult?.status === "failed" && (
          <div className="absolute bottom-3 left-3 right-3 bg-red-900/80 text-red-200 text-xs rounded px-3 py-2">
            Failed: {selectedResult.error}
          </div>
        )}
      </div>

      {/* ── Photo strip (bottom) ── */}
      <div ref={photoStripRef} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {photos.map(photo => {
          const result = resultsMap[photo.id];
          const isDone = result?.status === "complete";
          const isRunning = result?.status === "pending" || result?.status === "processing";
          const isActive = selectedPhoto.id === photo.id;
          return (
            <button
              key={photo.id}
              data-photoid={photo.id}
              onClick={() => { setSelectedPhotoId(photo.id); setShowOriginal(false); }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {photo.label ?? `Photo ${photo.id}`}
              {isDone && <span className={isActive ? "text-green-400" : "text-green-500"}>✓</span>}
              {isRunning && <span className="animate-spin inline-block">↻</span>}
            </button>
          );
        })}
      </div>

      {/* ── Action bar (below photo strip, context-aware) ── */}
      <div className="flex items-center justify-between gap-2 py-1">
        {/* Left: Apply or Regenerate for current photo */}
        <div>
          {isGenerating ? (
            <span className="text-sm text-gray-400 flex items-center gap-1.5">
              <span className="animate-spin">↻</span> Generating…
            </span>
          ) : isComplete ? (
            <button
              onClick={() => applyScene(selectedPhoto.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Regenerate"
            >
              <IconRegen /> Regenerate
            </button>
          ) : (
            <button
              onClick={() => applyScene(selectedPhoto.id)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Apply Scene
            </button>
          )}
        </div>

        {/* Right: Banner + Use (only when complete) */}
        {isComplete && selectedResult?.file_path && (
          <div className="flex gap-2">
            <button
              onClick={() => setBannerPhotoSrc(selectedResult.file_path!)}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              Banner
            </button>
            <button
              onClick={() => onAddShowroomPhoto?.(selectedResult.file_path!, `${selectedPhoto.label ?? "Photo"} — ${selectedSceneKey}`)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Use
            </button>
          </div>
        )}
      </div>

      {/* ── Banner composer ── */}
      {bannerPhotoSrc && (
        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Banner Composer</p>
            <button onClick={() => setBannerPhotoSrc(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <BannerComposer
            photoSrc={bannerPhotoSrc}
            carBlurbs={carBlurbs}
            dealerBlurbs={dealerBlurbs}
            badgePath={badgePath}
            onSave={handleSaveBanner}
            saving={savingBanner}
          />
        </div>
      )}
    </div>
  );
}
