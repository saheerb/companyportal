"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type OfficialRecord = {
  id: number;
  doc_type: string;
  doc_label: string;
  file_path: string | null;
  storage_ref: string | null;
  notes: string | null;
  created_at: string;
  car_reg: string | null;
  car_name: string | null;
  created_by: string | null;
};

type Car = { id: number; reg: string; car_name: string };

const DOC_TYPES = ["v5c", "mot", "contract", "invoice", "other"];

function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    doc_type: "other",
    doc_label: "",
    inventory_id: "",
    storage_ref: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(setCars);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let file_path: string | null = null;

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      file_path = data.path;
    }

    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, file_path }),
    });

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Upload Document</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
              <select required value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
              <input required value={form.doc_label} onChange={(e) => setForm({ ...form, doc_label: e.target.value })}
                placeholder="e.g. V5C for AB12 CDE"
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Linked Car (optional)</label>
              <select value={form.inventory_id} onChange={(e) => setForm({ ...form, inventory_id: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">None</option>
                {cars.map((c) => <option key={c.id} value={c.id}>{c.reg} {c.car_name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload File</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Or External URL</label>
              <input type="url" value={form.storage_ref} onChange={(e) => setForm({ ...form, storage_ref: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Uploading…" : "Save Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordsContent() {
  const [records, setRecords] = useState<OfficialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const searchParams = useSearchParams();
  const inventoryId = searchParams.get("inventory_id");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (inventoryId) params.set("inventory_id", inventoryId);
    if (docTypeFilter) params.set("doc_type", docTypeFilter);
    const res = await fetch(`/api/records?${params}`);
    setRecords(await res.json());
    setLoading(false);
  }, [inventoryId, docTypeFilter]);

  useEffect(() => { load(); }, [load]);

  async function deleteRecord(id: number) {
    if (!confirm("Delete this record?")) return;
    await fetch("/api/records", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Official Records</h2>
          {inventoryId && <p className="text-sm text-blue-600">Filtered by car</p>}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          + Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setDocTypeFilter("")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium border ${!docTypeFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
        >
          All
        </button>
        {DOC_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setDocTypeFilter(t === docTypeFilter ? "" : t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border uppercase ${docTypeFilter === t ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {records.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">No records found.</div>
          ) : records.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
              <div className="w-14 text-center">
                <span className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 rounded">{r.doc_type}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{r.doc_label}</p>
                {r.car_reg && (
                  <p className="text-xs text-gray-400 font-mono">{r.car_reg} {r.car_name}</p>
                )}
                {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                {r.file_path && (
                  <a href={r.file_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                    Download
                  </a>
                )}
                {r.storage_ref && (
                  <a href={r.storage_ref} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                    External Link
                  </a>
                )}
                <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                <span className="text-gray-300 text-xs">{r.created_by}</span>
                <button onClick={() => deleteRecord(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <UploadModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense>
      <RecordsContent />
    </Suspense>
  );
}
