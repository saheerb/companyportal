"use client";
import { useRef, useEffect, useState, useCallback } from "react";

interface BannerComposerProps {
  photoSrc: string;
  carBlurbs: string[];
  dealerBlurbs: string[];
  badgePath?: string | null;
  onSave: (blob: Blob) => void;
  saving?: boolean;
}

function proxyUrl(src: string): string {
  // Route GCS URLs through our server proxy to avoid CORS on canvas fetch
  if (src.startsWith("https://storage.googleapis.com/")) {
    return `/api/proxy-image?url=${encodeURIComponent(src)}`;
  }
  return src;
}

async function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  const res = await fetch(proxyUrl(src));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

export default function BannerComposer({
  photoSrc,
  carBlurbs,
  dealerBlurbs,
  badgePath,
  onSave,
  saving,
}: BannerComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBlurb, setSelectedBlurb] = useState<string | null>(null);
  const [showBadge, setShowBadge] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setImgLoaded(false);
    try {
      const img = await loadImageFromUrl(photoSrc);
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const barHeight = Math.round(img.naturalHeight * 0.1);
      const barY = img.naturalHeight - barHeight;

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, barY, img.naturalWidth, barHeight);

      if (showBadge && badgePath) {
        const badge = await loadImageFromUrl(badgePath);
        const scale = (barHeight * 0.85) / badge.naturalHeight;
        const bw = badge.naturalWidth * scale;
        const bh = badge.naturalHeight * scale;
        ctx.drawImage(badge, (img.naturalWidth - bw) / 2, barY + (barHeight - bh) / 2, bw, bh);
      } else if (selectedBlurb) {
        const fontSize = Math.round(img.naturalHeight * 0.034);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(selectedBlurb, img.naturalWidth / 2, barY + barHeight / 2);
      }

      setImgLoaded(true);
    } catch (e) {
      console.error("BannerComposer draw error:", e);
    }
  }, [photoSrc, selectedBlurb, showBadge, badgePath]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, "image/jpeg", 0.92);
  }

  const allBlurbs = [
    ...carBlurbs.map((b) => ({ text: b, type: "car" as const })),
    ...dealerBlurbs.map((b) => ({ text: b, type: "dealer" as const })),
  ];

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded border border-gray-200"
        style={{ maxHeight: 400, objectFit: "contain" }}
      />

      {allBlurbs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allBlurbs.map((b, i) => (
            <button
              key={i}
              onClick={() => {
                setShowBadge(false);
                setSelectedBlurb(selectedBlurb === b.text ? null : b.text);
              }}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selectedBlurb === b.text
                  ? "bg-blue-600 text-white border-blue-600"
                  : b.type === "dealer"
                  ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              }`}
            >
              {b.text}
            </button>
          ))}
        </div>
      )}

      {badgePath && (
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showBadge}
            onChange={(e) => { setShowBadge(e.target.checked); if (e.target.checked) setSelectedBlurb(null); }}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Show dealer badge</span>
        </label>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !imgLoaded}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
      >
        {saving ? "Saving…" : "Save with Banner"}
      </button>
    </div>
  );
}
