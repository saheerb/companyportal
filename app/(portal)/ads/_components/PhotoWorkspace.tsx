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

function proxyUrl(src: string): string {
  if (src.startsWith("https://storage.googleapis.com/")) {
    return `/api/proxy-image?url=${encodeURIComponent(src)}`;
  }
  return src;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number>(0);

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
  }, [inventoryId]);

  useEffect(() => {
    setShowOriginal(false);
    if (!selectedPhotoId) { setResults([]); return; }
    loadResults(selectedPhotoId);
  }, [selectedPhotoId]);

  // Poll while any result for selected photo is pending/processing
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
          loadPhotos(); // refresh active_file_path on thumbnails
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

  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) ?? null;
  const selectedIdx = photos.findIndex(p => p.id === selectedPhotoId);
  const activeDisplayUrl = selectedPhoto
    ? (selectedPhoto.active_file_path ?? selectedPhoto.file_path)
    : null;
  const displayUrl = selectedPhoto
    ? (showOriginal ? selectedPhoto.file_path : (activeDisplayUrl ?? selectedPhoto.file_path))
    : null;
  const hasGenerated = selectedPhoto?.active_showroom_id != null;
  const completeResults = results.filter(r => r.status === "complete");
  const pendingResults = results.filter(r => r.status === "pending" || r.status === "processing");
  const sceneLabel = (key: string) => scenes.find(s => s.scene_key === key)?.label ?? key;

  return (
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
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-400">No photos yet. Upload some above.</p>
      ) : (
        <>
          {/* Selected photo workspace */}
          {selectedPhoto && displayUrl && (
            <div className="border rounded-lg overflow-hidden">
              {/* Main photo */}
              <div
                className="relative bg-gray-900"
                style={{ aspectRatio: "4/3" }}
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                  const delta = e.changedTouches[0].clientX - touchStartX.current;
                  if (delta < -40 && selectedIdx < photos.length - 1) setSelectedPhotoId(photos[selectedIdx + 1].id);
                  else if (delta > 40 && selectedIdx > 0) setSelectedPhotoId(photos[selectedIdx - 1].id);
                }}
              >
                <img
                  src={proxyUrl(displayUrl)}
                  alt="Active"
                  className="w-full h-full object-contain"
                />
                {/* Left nav arrow */}
                {selectedIdx > 0 && (
                  <button
                    onClick={() => setSelectedPhotoId(photos[selectedIdx - 1].id)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                )}
                {/* Right nav arrow */}
                {selectedIdx < photos.length - 1 && (
                  <button
                    onClick={() => setSelectedPhotoId(photos[selectedIdx + 1].id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
                {/* Scene pills overlay — second row from top */}
                <div className="absolute top-9 inset-x-0 flex gap-1.5 px-2 py-1.5 overflow-x-auto scrollbar-none"
                  style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)" }}>
                  {generating || pendingResults.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-white text-xs px-2 py-1">
                      <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                      Generating…
                    </div>
                  ) : scenes.map(scene => (
                    <button
                      key={scene.scene_key}
                      onClick={() => handleGenerate(scene.scene_key)}
                      className="flex-shrink-0 px-2.5 py-1 text-xs rounded-full bg-black/50 text-white border border-white/20 hover:bg-black/70 whitespace-nowrap"
                    >
                      {scene.preview_emoji} {scene.label}
                    </button>
                  ))}
                </div>
                {/* Top-left: compare toggle or generating indicator */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {pendingResults.length > 0 ? (
                    <div className="flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                      Generating…
                    </div>
                  ) : hasGenerated && (
                    <button
                      onClick={() => setShowOriginal(v => !v)}
                      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                        showOriginal ? "bg-white text-gray-900" : "bg-black/50 text-white hover:bg-black/70"
                      }`}
                      title={showOriginal ? "Show generated" : "Compare with original"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                      </svg>
                    </button>
                  )}
                  {showOriginal && (
                    <span className="text-xs px-2 py-1 bg-white/90 text-gray-800 rounded font-medium">Original</span>
                  )}
                </div>
                {/* Top-right actions */}
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <a
                    href={`/api/proxy-image?url=${encodeURIComponent(activeDisplayUrl ?? selectedPhoto.file_path)}&download=1`}
                    download
                    className="w-7 h-7 bg-black/50 text-white rounded flex items-center justify-center hover:bg-black/70"
                    title="Download active photo"
                    onClick={e => e.stopPropagation()}
                  >
                    <IconDownload />
                  </a>
                  <button
                    onClick={() => handleDeleteSlot(selectedPhoto.id)}
                    className="w-7 h-7 bg-black/50 text-white rounded flex items-center justify-center hover:bg-red-600/80"
                    title="Delete this photo slot"
                  >
                    <IconTrash />
                  </button>
                </div>
                {/* Bottom-left: label edit */}
                <div className="absolute bottom-2 left-2">
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
                      onClick={() => { setEditingLabel(selectedPhoto.id); setLabelInput(selectedPhoto.label ?? ""); }}
                      className="text-xs px-2 py-1 bg-black/50 text-white rounded hover:bg-black/70"
                    >
                      {selectedPhoto.label ?? "Add label"}
                    </button>
                  )}
                </div>
                {/* Bottom-right: photo counter */}
                {photos.length > 1 && (
                  <div className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
                    {selectedIdx + 1} / {photos.length}
                  </div>
                )}
              </div>

              {/* Versions row */}
              <div className="bg-gray-50 border-t p-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Versions</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {/* Original */}
                  <VersionThumb
                    src={selectedPhoto.file_path}
                    label="Original"
                    isActive={selectedPhoto.active_showroom_id == null}
                    onSetActive={() => handleSetActive(selectedPhoto.id, null)}
                    canDelete={false}
                  />
                  {/* Generated versions */}
                  {completeResults.map((r, idx) => (
                    <VersionThumb
                      key={r.id}
                      src={r.file_path!}
                      label={`${sceneLabel(r.scene_id)} #${completeResults.length - idx}`}
                      isActive={selectedPhoto.active_showroom_id === r.id}
                      onSetActive={() => handleSetActive(selectedPhoto.id, r.id)}
                      onDelete={() => handleDeleteResult(r.id)}
                      canDelete={true}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}

function VersionThumb({
  src,
  label,
  isActive,
  onSetActive,
  onDelete,
  canDelete,
}: {
  src: string;
  label: string;
  isActive: boolean;
  onSetActive: () => void;
  onDelete?: () => void;
  canDelete: boolean;
}) {
  function proxyUrl(s: string) {
    return s.startsWith("https://storage.googleapis.com/")
      ? `/api/proxy-image?url=${encodeURIComponent(s)}`
      : s;
  }

  return (
    <div className={`relative flex-shrink-0 w-20 rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
      isActive ? "border-blue-500 shadow-md" : "border-gray-200 hover:border-gray-400"
    }`}>
      <div className="aspect-square bg-gray-100" onClick={onSetActive}>
        <img src={proxyUrl(src)} alt={label} className="w-full h-full object-cover" />
        {isActive && (
          <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
            <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
      <div className="px-1 py-0.5 bg-white flex items-center justify-between gap-0.5">
        <p className="text-xs text-gray-600 truncate flex-1" title={label}>{label}</p>
        {canDelete && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-gray-400 hover:text-red-500 flex-shrink-0"
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
