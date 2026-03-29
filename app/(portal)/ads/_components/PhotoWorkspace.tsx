"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Photo = {
  id: number;
  file_path: string;
  label: string | null;
  sort_order: number;
  active_showroom_id: number | null;
  active_file_path: string | null;
  active_scene_id: string | null;
  banner_blurb: string | null;
  banner_show_badge: boolean;
};

type ShowroomResult = {
  id: number;
  photo_id: number;
  scene_id: string;
  file_path: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

type Scene = {
  scene_key: string;
  label: string;
  preview_emoji: string;
};

function proxyUrl(src: string, width?: number): string {
  if (src.startsWith("https://storage.googleapis.com/")) {
    const w = width ? `&w=${width}` : "";
    return `/api/proxy-image?url=${encodeURIComponent(src)}${w}`;
  }
  return src;
}

async function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  const proxied = src.startsWith("https://storage.googleapis.com/")
    ? `/api/proxy-image?url=${encodeURIComponent(src)}`
    : src;
  const res = await fetch(proxied);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1v8M3.5 6.5l3 3 3-3M1 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconBanner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="17" x2="21" y2="17"/><line x1="8" y1="21" x2="8" y2="17"/>
  </svg>
);

const IconCompare = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
  </svg>
);

export default function PhotoWorkspace({ inventoryId, onPhotosChange }: {
  inventoryId: number;
  onPhotosChange?: (photos: Photo[]) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [results, setResults] = useState<ShowroomResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [bannerBlurb, setBannerBlurb] = useState<string | null>(null);
  const [bannerShowBadge, setBannerShowBadge] = useState(false);
  const [dealerSettings, setDealerSettings] = useState<{ dealer_blurbs: string[]; badge_path: string | null } | null>(null);
  const [carBlurbs, setCarBlurbs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number>(0);
  const dragSrcIdx = useRef<number>(-1);
  const bannerCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadPhotos = useCallback(async () => {
    const res = await fetch(`/api/car-photos?inventory_id=${inventoryId}`);
    const data = await res.json() as Photo[];
    setPhotos(data);
    onPhotosChange?.(data);
    return data;
  }, [inventoryId, onPhotosChange]);

  const loadResults = useCallback(async (photoId: number) => {
    const res = await fetch(`/api/showroom?photo_id=${photoId}`);
    const data = await res.json() as ShowroomResult[];
    setResults(data);
    return data;
  }, []);

  useEffect(() => {
    loadPhotos().then((data) => {
      if (data.length > 0) setSelectedPhotoId(data[0].id);
    });
    fetch("/api/showroom-scenes").then(r => r.json()).then(setScenes);
    fetch("/api/dealer-settings").then(r => r.json()).then(setDealerSettings);
    fetch(`/api/inventory/${inventoryId}`).then(r => r.json()).then((d: { car?: { car_blurbs?: string[] } }) => setCarBlurbs(d.car?.car_blurbs ?? []));
  }, [inventoryId]);

  useEffect(() => {
    setShowOriginal(false);
    if (!selectedPhotoId) { setResults([]); return; }
    loadResults(selectedPhotoId);
  }, [selectedPhotoId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setIsFullscreen(false); setShowBanner(false); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const hasPending = results.some(r => r.status === "pending" || r.status === "processing");
    if (hasPending && !pollRef.current && selectedPhotoId) {
      pollRef.current = setInterval(async () => {
        if (!selectedPhotoId) return;
        const updated = await loadResults(selectedPhotoId);
        const stillPending = updated.some(r => r.status === "pending" || r.status === "processing");
        if (!stillPending) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          loadPhotos();
        }
      }, 3000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current && !hasPending) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [results, selectedPhotoId]);

  // When banner panel opens, pre-populate from existing photo banner selection
  useEffect(() => {
    if (showBanner && selectedPhoto) {
      setBannerBlurb(selectedPhoto.banner_blurb ?? null);
      setBannerShowBadge(selectedPhoto.banner_show_badge ?? false);
    } else if (!showBanner) {
      setBannerBlurb(null);
      setBannerShowBadge(false);
    }
  }, [showBanner]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    let lastId: number | null = null;
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const { path: filePath } = await uploadRes.json() as { path: string };
      const photoRes = await fetch("/api/car-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_id: inventoryId, file_path: filePath }),
      });
      const newPhoto = await photoRes.json() as Photo;
      lastId = newPhoto.id;
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const updated = await loadPhotos();
    if (lastId) setSelectedPhotoId(lastId);
    else if (updated.length > 0 && !selectedPhotoId) setSelectedPhotoId(updated[0].id);
  }

  async function handleGenerate(sceneKey: string) {
    if (!selectedPhotoId || generating || pendingResults.length > 0) return;
    setGenerating(true);
    await fetch("/api/showroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: selectedPhotoId, scene_id: sceneKey }),
    });
    setGenerating(false);
    await loadResults(selectedPhotoId);
  }

  async function handleSetActive(photoId: number, showroomId: number | null) {
    await fetch(`/api/car-photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_showroom_id: showroomId }),
    });
    setShowOriginal(false);
    await loadPhotos();
  }

  async function handleDeleteResult(resultId: number) {
    if (!confirm("Delete this generated version?")) return;
    await fetch(`/api/showroom/${resultId}`, { method: "DELETE" });
    if (selectedPhotoId) await loadResults(selectedPhotoId);
    await loadPhotos();
  }

  async function handleDeleteSlot(photoId: number) {
    if (!confirm("Delete this photo and all its generated versions?")) return;
    setIsFullscreen(false);
    await fetch("/api/car-photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photoId }),
    });
    const updated = await loadPhotos();
    if (selectedPhotoId === photoId) {
      setSelectedPhotoId(updated[0]?.id ?? null);
      setResults([]);
    }
  }

  async function saveLabel(photoId: number) {
    await fetch(`/api/car-photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: labelInput.trim() || null }),
    });
    setEditingLabel(null);
    loadPhotos();
  }

  async function downloadAllZip() {
    setDownloadingZip(true);
    const res = await fetch(`/api/car-photos/download-zip?inventory_id=${inventoryId}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photos_${inventoryId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setDownloadingZip(false);
  }

  function navigatePrev() {
    if (selectedIdx > 0) setSelectedPhotoId(photos[selectedIdx - 1].id);
  }
  function navigateNext() {
    if (selectedIdx < photos.length - 1) setSelectedPhotoId(photos[selectedIdx + 1].id);
  }
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -40) navigateNext();
    else if (delta > 40) navigatePrev();
  }

  function handleDragStart(idx: number) { dragSrcIdx.current = idx; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function handleDrop(dropIdx: number) {
    const src = dragSrcIdx.current;
    dragSrcIdx.current = -1;
    if (src < 0 || src === dropIdx) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(src, 1);
    reordered.splice(dropIdx, 0, moved);
    setPhotos(reordered);
    onPhotosChange?.(reordered);
    await fetch("/api/car-photos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map(p => p.id) }),
    });
  }

  async function handleSaveBannerSelection() {
    if (!selectedPhotoId) return;
    setSavingBanner(true);
    try {
      await fetch(`/api/car-photos/${selectedPhotoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banner_blurb: bannerBlurb,
          banner_show_badge: bannerShowBadge,
        }),
      });
      setShowBanner(false);
      await loadPhotos();
    } finally {
      setSavingBanner(false);
    }
  }

  async function downloadWithBanner(photo: Photo) {
    const img = await loadImageForCanvas(photo.file_path);
    const canvas = bannerCanvasRef.current!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const barHeight = Math.round(img.naturalHeight * 0.1);
    const barY = img.naturalHeight - barHeight;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, barY, img.naturalWidth, barHeight);
    if (photo.banner_show_badge && dealerSettings?.badge_path) {
      const badge = await loadImageForCanvas(dealerSettings.badge_path);
      const scale = (barHeight * 0.85) / badge.naturalHeight;
      const bw = badge.naturalWidth * scale;
      const bh = badge.naturalHeight * scale;
      ctx.drawImage(badge, (img.naturalWidth - bw) / 2, barY + (barHeight - bh) / 2, bw, bh);
    } else if (photo.banner_blurb) {
      const fontSize = Math.round(img.naturalHeight * 0.034);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(photo.banner_blurb, img.naturalWidth / 2, barY + barHeight / 2);
    }
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "photo-banner.jpg";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/jpeg", 0.92);
  }

  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) ?? null;
  const selectedIdx = photos.findIndex(p => p.id === selectedPhotoId);
  const activeDisplayUrl = selectedPhoto ? (selectedPhoto.active_file_path ?? selectedPhoto.file_path) : null;
  const displayUrl = selectedPhoto
    ? (showOriginal ? selectedPhoto.file_path : (activeDisplayUrl ?? selectedPhoto.file_path))
    : null;
  const completeResults = results.filter(r => r.status === "complete");
  const pendingResults = results.filter(r => r.status === "pending" || r.status === "processing");
  const hasGenerated = (selectedPhoto?.active_showroom_id != null) || completeResults.length > 0;
  const hasBanner = !!(selectedPhoto?.banner_blurb || selectedPhoto?.banner_show_badge);
  const isBusy = generating || pendingResults.length > 0;
  const sceneLabel = (key: string) => scenes.find(s => s.scene_key === key)?.label ?? key;

  const allBannerBlurbs = [
    ...carBlurbs.map((b) => ({ text: b, type: "car" as const })),
    ...(dealerSettings?.dealer_blurbs ?? []).map((b) => ({ text: b, type: "dealer" as const })),
  ];

  // Inline card overlays — minimal: nav, label, counter, download/delete, open editor
  function PhotoOverlays() {
    if (!selectedPhoto || !activeDisplayUrl) return null;
    return (
      <>
        {/* Top bar: open editor | spacer | download | delete */}
        <div
          className="absolute top-0 inset-x-0 z-10 h-11 flex items-center gap-2 px-2 bg-black/70"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setShowBanner(false); setIsFullscreen(true); }}
            className="flex items-center gap-1.5 px-3 h-7 text-xs font-medium bg-white/20 text-white rounded hover:bg-white/30 whitespace-nowrap"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
            Photo Studio
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <a
              href={`/api/proxy-image?url=${encodeURIComponent(activeDisplayUrl)}&download=1`}
              download
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded"
              title="Download"
            >
              <IconDownload />
            </a>
            <button
              onClick={() => handleDeleteSlot(selectedPhoto.id)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-red-500/60 rounded"
              title="Delete photo"
            >
              <IconTrash />
            </button>
          </div>
        </div>

        {/* Nav arrows */}
        {selectedIdx > 0 && (
          <button
            onClick={e => { e.stopPropagation(); navigatePrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        {selectedIdx < photos.length - 1 && (
          <button
            onClick={e => { e.stopPropagation(); navigateNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}

        {/* Bottom-left: label */}
        <div className="absolute bottom-2 left-2 z-10">
          {editingLabel === selectedPhoto.id ? (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveLabel(selectedPhoto.id); if (e.key === "Escape") setEditingLabel(null); }}
                className="text-xs px-2 py-1 rounded bg-white border border-gray-300 focus:outline-none w-28"
              />
              <button onClick={() => saveLabel(selectedPhoto.id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">OK</button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setEditingLabel(selectedPhoto.id); setLabelInput(selectedPhoto.label ?? ""); }}
              className="text-xs px-2 py-1 bg-black/60 text-white rounded hover:bg-black/80"
            >
              {selectedPhoto.label ?? "Add label"}
            </button>
          )}
        </div>

        {/* Bottom-right: counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-2 right-2 z-10 text-xs bg-black/60 text-white px-2 py-1 rounded">
            {selectedIdx + 1} / {photos.length}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Hidden canvas for banner compositing */}
      <canvas ref={bannerCanvasRef} className="hidden" />

      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className={`cursor-pointer px-3 py-1.5 text-sm rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? "Uploading…" : "+ Upload Photos"}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </label>
          {photos.length > 0 && (
            <button
              onClick={downloadAllZip}
              disabled={downloadingZip}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <IconDownload />
              {downloadingZip ? "Preparing…" : "Download All (ZIP)"}
            </button>
          )}
          {photos.length > 1 && (
            <button
              onClick={() => setShowReorder(v => !v)}
              className={`px-3 py-1.5 text-sm border rounded flex items-center gap-1.5 transition-colors ${showReorder ? "bg-blue-50 border-blue-400 text-blue-700" : "hover:bg-gray-50"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              Reorder Photos
            </button>
          )}
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-gray-400">No photos yet. Upload some above.</p>
        ) : selectedPhoto && displayUrl && (
          <div className="border rounded-lg overflow-hidden">
            {/* Inline photo */}
            <div
              className="relative bg-gray-900 cursor-pointer"
              style={{ aspectRatio: "4/3" }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onClick={() => setIsFullscreen(true)}
            >
              <img src={proxyUrl(displayUrl, 900)} alt="Active" className="w-full h-full object-contain" />
              {/* Banner overlay preview */}
              {(selectedPhoto.banner_blurb || selectedPhoto.banner_show_badge) && (
                <div className="absolute bottom-0 inset-x-0 h-[10%] flex items-center justify-center bg-black/65 pointer-events-none z-10">
                  {selectedPhoto.banner_show_badge && dealerSettings?.badge_path
                    ? <img src={proxyUrl(dealerSettings.badge_path, 200)} alt="" className="h-[85%] object-contain" />
                    : <span className="text-white font-bold text-xs sm:text-sm px-3 text-center truncate">{selectedPhoto.banner_blurb}</span>
                  }
                </div>
              )}
              <PhotoOverlays />
            </div>

            {/* Reorder strip — only shown when toggled */}
            {showReorder && (
              <div className="border-t p-3 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Drag to reorder</p>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {photos.map((photo, idx) => {
                    const thumbSrc = photo.active_file_path ?? photo.file_path;
                    const isCurrent = photo.id === selectedPhotoId;
                    return (
                      <div
                        key={photo.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        onClick={() => setSelectedPhotoId(photo.id)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                          isCurrent ? "border-blue-500" : "border-gray-200 hover:border-gray-400"
                        }`}
                        title={photo.label ?? `Photo ${idx + 1}`}
                      >
                        <img src={proxyUrl(thumbSrc, 200)} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 text-center text-white text-[9px] bg-black/50 py-0.5">
                          {idx + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && selectedPhoto && displayUrl && activeDisplayUrl && (
        <div
          className="fixed inset-0 z-50 bg-black"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Photo fills screen — use original when banner panel is open so preview matches the saved result */}
          <img src={proxyUrl(showBanner ? selectedPhoto.file_path : displayUrl, 1600)} alt="Active" className="w-full h-full object-contain" />

          {/* Banner overlay — always shown when photo has a banner; interactive preview while panel is open */}
          {(showBanner ? (bannerBlurb || bannerShowBadge) : (selectedPhoto.banner_blurb || selectedPhoto.banner_show_badge)) && (
            <div
              className="absolute inset-x-0 z-25 flex items-center justify-center bg-black/65 pointer-events-none"
              style={{ bottom: showBanner ? 152 : 0, height: "10%", minHeight: 44 }}
            >
              {(showBanner ? bannerShowBadge : selectedPhoto.banner_show_badge) && dealerSettings?.badge_path ? (
                <img src={proxyUrl(dealerSettings.badge_path, 300)} alt="Badge" className="h-[85%] object-contain" />
              ) : (
                <span className="text-white font-bold text-sm sm:text-base px-4 text-center">
                  {showBanner ? bannerBlurb : selectedPhoto.banner_blurb}
                </span>
              )}
            </div>
          )}

          {/* Single top bar: compare | spacer | counter | banner | download | delete | close */}
          <div
            className="absolute top-0 inset-x-0 z-20 h-12 flex items-center gap-2 px-3 bg-black/70"
            onClick={e => e.stopPropagation()}
          >
            {/* Compare toggle */}
            {hasGenerated && !isBusy && (
              <button
                onClick={() => setShowOriginal(v => !v)}
                className={`w-8 h-8 flex-shrink-0 rounded flex items-center justify-center transition-colors ${
                  showOriginal ? "bg-white text-gray-900" : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title={showOriginal ? "Show generated" : "Compare with original"}
              >
                <IconCompare />
              </button>
            )}

            {/* Scene pills */}
            <div className="flex-1 flex gap-1.5 overflow-x-auto min-w-0" style={{ scrollbarWidth: "none" }}>
              {isBusy ? (
                <div className="flex items-center gap-1.5 text-white text-xs px-1">
                  <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                  Generating…
                </div>
              ) : scenes.map(scene => (
                <button
                  key={scene.scene_key}
                  onClick={() => handleGenerate(scene.scene_key)}
                  className="flex-shrink-0 px-2.5 py-1 text-xs rounded-full bg-white/20 text-white border border-white/25 hover:bg-white/35 whitespace-nowrap"
                >
                  {scene.preview_emoji} {scene.label}
                </button>
              ))}
            </div>

            {/* Photo counter */}
            {photos.length > 1 && (
              <span className="text-xs text-white/60 flex-shrink-0">{selectedIdx + 1}/{photos.length}</span>
            )}

            {/* Action icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowBanner(v => !v)}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${showBanner ? "bg-white text-gray-900" : "text-white hover:bg-white/20"}`}
                title="Add banner"
              >
                <IconBanner />
              </button>
              {hasBanner ? (
                <button
                  onClick={e => { e.stopPropagation(); downloadWithBanner(selectedPhoto); }}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded"
                  title="Download with banner"
                >
                  <IconDownload />
                </button>
              ) : (
                <a
                  href={`/api/proxy-image?url=${encodeURIComponent(activeDisplayUrl)}&download=1`}
                  download
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded"
                  title="Download"
                >
                  <IconDownload />
                </a>
              )}
              <button
                onClick={() => handleDeleteSlot(selectedPhoto.id)}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-red-500/60 rounded"
                title="Delete photo"
              >
                <IconTrash />
              </button>
              <button
                onClick={() => { setIsFullscreen(false); setShowBanner(false); }}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded text-lg leading-none"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Original badge */}
          {showOriginal && !showBanner && (
            <div className="absolute top-14 left-3 z-20 text-xs px-2 py-1 bg-white/90 text-gray-800 rounded font-medium">
              Original
            </div>
          )}

          {/* Nav arrows */}
          {selectedIdx > 0 && (
            <button
              onClick={navigatePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {selectedIdx < photos.length - 1 && (
            <button
              onClick={navigateNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {/* Bottom: banner options panel OR version strip */}
          {showBanner ? (
            <div
              className="absolute bottom-0 inset-x-0 z-30 bg-gray-950/95 border-t border-white/10 px-3 pt-3 pb-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Blurb chips */}
              {allBannerBlurbs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3 max-h-28 overflow-y-auto">
                  {allBannerBlurbs.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => { setBannerShowBadge(false); setBannerBlurb(bannerBlurb === b.text ? null : b.text); }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        bannerBlurb === b.text
                          ? "bg-blue-600 text-white border-blue-600"
                          : b.type === "dealer"
                          ? "bg-purple-900/50 text-purple-200 border-purple-500/50 hover:bg-purple-800/50"
                          : "bg-white/10 text-white/80 border-white/20 hover:bg-white/20"
                      }`}
                    >
                      {b.text}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40 mb-3">No blurbs yet — generate car blurbs from the inventory page.</p>
              )}

              {/* Badge toggle + Save */}
              <div className="flex items-center gap-3 flex-wrap">
                {dealerSettings?.badge_path && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={bannerShowBadge}
                      onChange={e => { setBannerShowBadge(e.target.checked); if (e.target.checked) setBannerBlurb(null); }}
                      className="rounded"
                    />
                    Dealer badge
                  </label>
                )}
                {hasBanner && (
                  <button
                    onClick={() => fetch(`/api/car-photos/${selectedPhotoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banner_blurb: null, banner_show_badge: false }) }).then(() => loadPhotos())}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove banner
                  </button>
                )}
                <button
                  onClick={handleSaveBannerSelection}
                  disabled={savingBanner || (!bannerBlurb && !bannerShowBadge)}
                  className="px-4 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
                >
                  {savingBanner ? "Saving…" : hasBanner ? "Update Banner" : "Save Banner"}
                </button>
              </div>
            </div>
          ) : completeResults.length > 0 && (
            <div
              className="absolute bottom-0 inset-x-0 z-20 bg-black/70 px-3 py-2 flex gap-2 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
              onClick={e => e.stopPropagation()}
            >
              <VersionThumb
                src={selectedPhoto.file_path}
                label="Original"
                isActive={selectedPhoto.active_showroom_id == null}
                onSetActive={() => handleSetActive(selectedPhoto.id, null)}
                canDelete={false}
                dark
              />
              {completeResults.map((r, idx) => (
                <VersionThumb
                  key={r.id}
                  src={r.file_path!}
                  label={`${sceneLabel(r.scene_id)} #${completeResults.length - idx}`}
                  isActive={selectedPhoto.active_showroom_id === r.id}
                  onSetActive={() => handleSetActive(selectedPhoto.id, r.id)}
                  onDelete={() => handleDeleteResult(r.id)}
                  canDelete={true}
                  dark
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function VersionThumb({
  src,
  label,
  isActive,
  onSetActive,
  onDelete,
  canDelete,
  dark,
}: {
  src: string;
  label: string;
  isActive: boolean;
  onSetActive: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  dark?: boolean;
}) {
  function px(s: string) {
    return s.startsWith("https://storage.googleapis.com/")
      ? `/api/proxy-image?url=${encodeURIComponent(s)}&w=200`
      : s;
  }
  return (
    <div className={`relative flex-shrink-0 w-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
      isActive
        ? dark ? "border-blue-400 shadow-md" : "border-blue-500 shadow-md"
        : dark ? "border-white/20 hover:border-white/50" : "border-gray-200 hover:border-gray-400"
    }`}>
      <div className="aspect-square bg-gray-800" onClick={onSetActive}>
        <img src={px(src)} alt={label} className="w-full h-full object-cover" />
        {isActive && (
          <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
      <div className={`px-1 py-0.5 flex items-center justify-between gap-0.5 ${dark ? "bg-black/60" : "bg-white"}`}>
        <p className={`text-xs truncate flex-1 ${dark ? "text-white/80" : "text-gray-600"}`} title={label}>{label}</p>
        {canDelete && onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className={`flex-shrink-0 ${dark ? "text-white/50 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
