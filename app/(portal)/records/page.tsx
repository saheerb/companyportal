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
  record_date: string | null;
  inventory_id: number | null;
  investment_id: number | null;
  car_reg: string | null;
  car_name: string | null;
  investment_name: string | null;
  created_by: string | null;
  created_by_label: string | null;
};

type Car = { id: number; reg: string; car_name: string };
type Investment = { id: number; name: string; type: string };

const DOC_TYPES = ["v5c", "mot", "contract", "invoice", "other"];

const inputCls = "w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";

function RecordModal({
  record,
  onClose,
  onSaved,
  onDeleted,
  prefillInvestmentId,
}: {
  record?: OfficialRecord;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  prefillInvestmentId?: string;
}) {
  const isEdit = !!record;
  const [form, setForm] = useState({
    doc_type: record?.doc_type ?? "other",
    doc_label: record?.doc_label ?? "",
    inventory_id: record?.inventory_id ? String(record.inventory_id) : "",
    investment_id: record?.investment_id ? String(record.investment_id) : (prefillInvestmentId ?? ""),
    storage_ref: record?.storage_ref ?? "",
    notes: record?.notes ?? "",
    record_date: record?.record_date
      ? record.record_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    created_by_label: record?.created_by_label ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(setCars);
    fetch("/api/finance/overview").then(r => r.json()).then((d) => setInvestments(d.investments ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let file_path: string | null = record?.file_path ?? null;

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      file_path = data.path;
    }

    if (isEdit) {
      await fetch("/api/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record!.id, ...form, file_path }),
      });
    } else {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, file_path }),
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!confirm("Delete this record?")) return;
    setDeleting(true);
    await fetch("/api/records", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: record!.id }),
    });
    setDeleting(false);
    onDeleted?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{isEdit ? "Edit Record" : "Upload Document"}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
              <select required value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} className={inputCls}>
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
              <input required value={form.doc_label} onChange={(e) => setForm({ ...form, doc_label: e.target.value })}
                placeholder="e.g. V5C for AB12 CDE" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Linked Car (optional)</label>
              <select value={form.inventory_id} onChange={(e) => setForm({ ...form, inventory_id: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {cars.map((c) => <option key={c.id} value={c.id}>{c.reg} {c.car_name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Linked Investment (optional)</label>
              <select value={form.investment_id} onChange={(e) => setForm({ ...form, investment_id: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {investments.map((inv) => <option key={inv.id} value={inv.id}>{inv.name} ({inv.type})</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isEdit ? "Replace File" : "Upload File"}
              </label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm border rounded px-2 py-1.5" />
              {isEdit && record?.file_path && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">{file ? "New file selected" : "Current file kept unless you pick a new one"}</p>
                  {!file && (
                    <a href={record.file_path} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium">
                      Download current file ↗
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Or External URL</label>
              <input type="url" value={form.storage_ref} onChange={(e) => setForm({ ...form, storage_ref: e.target.value })}
                placeholder="https://drive.google.com/..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input required type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Uploaded by</label>
              <input value={form.created_by_label} onChange={(e) => setForm({ ...form, created_by_label: e.target.value })}
                placeholder="Leave blank for your name" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            {isEdit ? (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Document"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordsContent() {
  const [records, setRecords] = useState<OfficialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OfficialRecord | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const searchParams = useSearchParams();
  const inventoryId = searchParams.get("inventory_id");
  const investmentId = searchParams.get("investment_id");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (inventoryId) params.set("inventory_id", inventoryId);
    if (investmentId) params.set("investment_id", investmentId);
    if (docTypeFilter) params.set("doc_type", docTypeFilter);
    const res = await fetch(`/api/records?${params}`);
    setRecords(await res.json());
    setLoading(false);
  }, [inventoryId, investmentId, docTypeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Official Records</h2>
          {inventoryId && <p className="text-sm text-blue-600">Filtered by car</p>}
          {investmentId && <p className="text-sm text-blue-600">Filtered by investment</p>}
        </div>
        <button
          onClick={() => setShowUpload(true)}
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
          ) : records.map((r) => {
            const displayDate = r.record_date
              ? new Date(r.record_date).toLocaleDateString("en-GB")
              : new Date(r.created_at).toLocaleDateString("en-GB");
            const displayBy = r.created_by_label || r.created_by;
            return (
              <div key={r.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                <div className="w-14 text-center shrink-0">
                  <span className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 rounded">{r.doc_type}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.doc_label}</p>
                  {r.car_reg && (
                    <p className="text-xs text-gray-400 font-mono">{r.car_reg} {r.car_name}</p>
                  )}
                  {r.investment_name && (
                    <p className="text-xs text-purple-500">Investment: {r.investment_name}</p>
                  )}
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-gray-400">{displayDate}</span>
                  {displayBy && <span className="text-gray-300">{displayBy}</span>}
                  {r.file_path && (
                    <a href={r.file_path} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline font-medium">
                      Download
                    </a>
                  )}
                  {r.storage_ref && (
                    <a href={r.storage_ref} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline font-medium">
                      Link
                    </a>
                  )}
                  <button
                    onClick={() => setEditingRecord(r)}
                    className="px-2.5 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUpload && (
        <RecordModal
          onClose={() => setShowUpload(false)}
          onSaved={load}
          prefillInvestmentId={investmentId ?? undefined}
        />
      )}
      {editingRecord && (
        <RecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={load}
          onDeleted={load}
        />
      )}
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
