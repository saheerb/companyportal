"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PhotoWorkspace from "../_components/PhotoWorkspace";
import PlatformSelector from "../_components/PlatformSelector";
import VideoPanel from "../_components/VideoPanel";

type Listing = {
  id: number;
  inventory_id: number;
  title: string;
  description: string;
  price: number;
  selected_photo_ids: number[] | null;
  status: string;
  published_at: string | null;
  car_name: string | null;
  reg: string;
};

type Publication = {
  platform: string;
  status: string;
  published_at: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  archived: "bg-red-100 text-red-600",
};

export default function AdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ listing: Listing; publications: Publication[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  const [photosList, setPhotosList] = useState<{ id: number; file_path: string; label: string | null }[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  async function load() {
    const res = await fetch(`/api/listings/${id}`);
    if (!res.ok) { router.push("/ads"); return; }
    const d = await res.json() as { listing: Listing; publications: Publication[] };
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function startEdit() {
    if (!data) return;
    setEditForm({
      title: data.listing.title,
      description: data.listing.description,
      price: String(data.listing.price),
    });
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description,
        price: parseFloat(editForm.price),
      }),
    });
    setSaving(false);
    setEditing(false);
    load();
  }

  async function generateDescription() {
    if (!data) return;
    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/listings/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_id: data.listing.inventory_id }),
      });
      const { description } = await res.json() as { description?: string };
      if (description) setEditForm((f) => ({ ...f, description }));
    } catch {
      // ignore
    } finally {
      setGeneratingDesc(false);
    }
  }

  async function handlePublish() {
    if (selectedPlatforms.length === 0) return;
    setPublishing(true);
    await fetch(`/api/listings/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms: selectedPlatforms }),
    });
    setPublishing(false);
    load();
  }

  async function handleUnpublish() {
    if (!confirm("Unpublish this ad from all platforms?")) return;
    await fetch(`/api/listings/${id}/unpublish`, { method: "POST" });
    load();
  }

  async function handleDelete() {
    if (!confirm("Archive this ad?")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    router.push("/ads");
  }

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data) return null;
  const { listing, publications } = data;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/ads" className="text-blue-600 hover:underline">← Ads</Link>
            <span>/</span>
            <Link href={`/inventory/${listing.inventory_id}`} className="text-blue-600 hover:underline">
              {listing.reg}{listing.car_name ? ` — ${listing.car_name}` : ""}
            </Link>
          </div>
          <h2 className="text-2xl font-bold mt-1">{listing.title}</h2>
          <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[listing.status] ?? "bg-gray-100"}`}>
            {listing.status}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing && (
            <button onClick={startEdit} className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700">
              Edit
            </button>
          )}
          <button onClick={handleDelete} className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">
            Archive
          </button>
        </div>
      </div>

      {/* Ad details */}
      <div className="bg-white rounded-lg border p-5">
        {editing ? (
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">Description</label>
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={generatingDesc}
                  className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                >
                  {generatingDesc ? "Generating…" : "✨ Generate with AI"}
                </button>
              </div>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={6}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price (£)</label>
              <input
                type="number"
                step="1"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-start gap-4">
              <p className="text-gray-700 leading-relaxed">{listing.description}</p>
              <p className="text-xl font-bold text-gray-900 shrink-0">
                £{Number(listing.price).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Photos */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="font-semibold mb-4">Photos</h3>
        <PhotoWorkspace
          inventoryId={listing.inventory_id}
          onPhotosChange={setPhotosList}
        />
      </div>

      {/* Videos */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="font-semibold mb-1">Videos</h3>
        <p className="text-xs text-gray-400 mb-4">Generate AI video clips for this car using Veo 2. Videos take 1-3 minutes.</p>
        <VideoPanel
          inventoryId={listing.inventory_id}
          carName={listing.car_name ?? listing.reg}
          photos={photosList}
        />
      </div>

      {/* Publishing */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Publishing</h3>
          {listing.status === "published" && (
            <button
              onClick={handleUnpublish}
              className="text-sm text-orange-600 border border-orange-200 px-3 py-1.5 rounded hover:bg-orange-50"
            >
              Unpublish All
            </button>
          )}
        </div>

        <PlatformSelector
          selected={selectedPlatforms}
          onChange={setSelectedPlatforms}
          publications={publications}
        />

        {selectedPlatforms.length > 0 && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="mt-4 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? "Publishing…" : `Publish to ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? "s" : ""}`}
          </button>
        )}

        {publications.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase">Publication History</p>
            {publications.map((pub) => (
              <div key={pub.platform} className="flex items-center justify-between text-sm">
                <span className="capitalize">{pub.platform === "autotrader" ? "AutoTrader" : "Facebook Marketplace"}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    pub.status === "live" ? "bg-green-100 text-green-700" :
                    pub.status === "removed" ? "bg-gray-100 text-gray-500" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {pub.status}
                  </span>
                  {pub.published_at && (
                    <span className="text-xs text-gray-400">
                      {new Date(pub.published_at).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
