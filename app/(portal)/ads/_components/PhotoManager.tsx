"use client";

import { useEffect, useRef, useState } from "react";

type Photo = {
  id: number;
  file_path: string;
  processed_path: string | null;
  label: string | null;
  sort_order: number;
  processing_status: string;
  processing_error: string | null;
};

type PollJob = {
  jobId: number;
  photoId: number;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  queued: "bg-yellow-100 text-yellow-600",
  processing: "bg-blue-100 text-blue-600",
  complete: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

export default function PhotoManager({
  inventoryId,
  selectedIds,
  onSelectionChange,
  showDownload = false,
  onPhotosChange,
}: {
  inventoryId: number;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  showDownload?: boolean;
  onPhotosChange?: (photos: Photo[]) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingJobs = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  async function loadPhotos() {
    const res = await fetch(`/api/car-photos?inventory_id=${inventoryId}`);
    const data = await res.json() as Photo[];
    setPhotos(data);
    onPhotosChange?.(data);
  }

  useEffect(() => {
    loadPhotos();
    return () => {
      pollingJobs.current.forEach((interval) => clearInterval(interval));
    };
  }, [inventoryId]);

  function startPolling(jobId: number, photoId: number) {
    if (pollingJobs.current.has(jobId)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-jobs/${jobId}`);
        const job = await res.json() as { status: string; photo?: { processing_status: string; processed_path: string | null } };
        if (job.status === "complete" || job.status === "failed") {
          clearInterval(interval);
          pollingJobs.current.delete(jobId);
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === photoId
                ? {
                    ...p,
                    processing_status: job.photo?.processing_status ?? job.status,
                    processed_path: job.photo?.processed_path ?? p.processed_path,
                  }
                : p
            )
          );
        }
      } catch {
        clearInterval(interval);
        pollingJobs.current.delete(jobId);
      }
    }, 3000);
    pollingJobs.current.set(jobId, interval);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const { path: filePath } = await uploadRes.json() as { path: string };
      await fetch("/api/car-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_id: inventoryId, file_path: filePath }),
      });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await loadPhotos();
  }

  async function handleRemoveBg(photo: Photo) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, processing_status: "queued" } : p))
    );
    const res = await fetch("/api/ai-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photo.id }),
    });
    const { job_id } = await res.json() as { job_id: number };
    if (job_id) startPolling(job_id, photo.id);
  }

  async function handleDelete(photoId: number) {
    if (!confirm("Delete this photo?")) return;
    await fetch("/api/car-photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photoId }),
    });
    onSelectionChange(selectedIds.filter((id) => id !== photoId));
    await loadPhotos();
  }

  function handleDragStart(photoId: number) {
    dragIdRef.current = photoId;
  }

  function handleDragOver(e: React.DragEvent, photoId: number) {
    e.preventDefault();
    setDragOverId(photoId);
  }

  async function handleDrop(targetId: number) {
    setDragOverId(null);
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || fromId === targetId) return;

    const fromIdx = photos.findIndex((p) => p.id === fromId);
    const toIdx = photos.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(fromIdx, 1);
    newPhotos.splice(toIdx, 0, moved);
    setPhotos(newPhotos);

    await fetch("/api/car-photos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newPhotos.map((p) => p.id) }),
    });
  }

  function toggleSelect(photoId: number) {
    if (selectedIds.includes(photoId)) {
      onSelectionChange(selectedIds.filter((id) => id !== photoId));
    } else {
      onSelectionChange([...selectedIds, photoId]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className={`cursor-pointer px-4 py-2 text-sm rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "Uploading…" : "+ Upload Photos"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </label>
        <p className="text-xs text-gray-400">Drag to reorder · Click to select for ad</p>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-400">No photos yet. Upload some above.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const displayPath = photo.processed_path ?? photo.file_path;
            const isSelected = selectedIds.includes(photo.id);
            const isProcessing = photo.processing_status === "queued" || photo.processing_status === "processing";
            const isDragOver = dragOverId === photo.id;
            return (
              <div
                key={photo.id}
                draggable
                onDragStart={() => handleDragStart(photo.id)}
                onDragOver={(e) => handleDragOver(e, photo.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDrop(photo.id)}
                onDragEnd={() => { setDragOverId(null); dragIdRef.current = null; }}
                className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                  isDragOver ? "border-blue-400 scale-105 shadow-lg" :
                  isSelected ? "border-blue-500 shadow-md" : "border-gray-200 hover:border-gray-300"
                } cursor-grab active:cursor-grabbing`}
                onClick={() => toggleSelect(photo.id)}
              >
                {/* Photo */}
                <div className="aspect-square bg-gray-100 relative">
                  <img
                    src={displayPath}
                    alt={photo.label ?? "Car photo"}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {/* Drag handle indicator */}
                  <div className="absolute top-1.5 left-1.5 text-white/70 text-xs select-none">⠿</div>
                </div>

                {/* Actions */}
                <div className="p-2 bg-white flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {showDownload && (
                    <a
                      href={`/api/proxy-image?url=${encodeURIComponent(displayPath)}&download=1`}
                      download
                      className="text-xs text-gray-500 hover:text-gray-700"
                      title="Download"
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v8M3.5 6.5l3 3 3-3M1 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(photo.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
