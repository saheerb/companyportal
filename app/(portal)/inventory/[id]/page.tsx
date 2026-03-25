"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Car = {
  id: number;
  reg: string;
  car_name: string;
  colour: string;
  status: string;
  purchase_price: number | null;
  purchase_date: string | null;
  location: string | null;
  mileage_bought: number | null;
  notes: string | null;
  lead_name: string | null;
  lead_id: number | null;
  created_at: string;
};

type FinanceEntry = {
  id: number;
  type: string;
  category: string;
  description: string;
  amount: number;
  entry_date: string;
  notes: string | null;
  vat_claimable: boolean;
  off_the_records: boolean;
};

type Record_ = {
  id: number;
  doc_type: string;
  doc_label: string;
  file_path: string | null;
  storage_ref: string | null;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["Bought", "Being Prepped", "Listed for Sale", "Sold"];
const EXPENSE_CATEGORIES = ["car_purchase", "repair_service", "preparation", "delivery", "commission", "other"];
const INCOME_CATEGORIES = ["car_sale", "other"];
const DOC_TYPES = ["v5c", "mot", "contract", "invoice", "other"];

const statusColors: Record<string, string> = {
  Bought: "bg-blue-100 text-blue-700",
  "Being Prepped": "bg-yellow-100 text-yellow-700",
  "Listed for Sale": "bg-purple-100 text-purple-700",
  Sold: "bg-green-100 text-green-700",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ car: Car; finance: FinanceEntry[]; records: Record_[]; profit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Car edit state
  const [editingCar, setEditingCar] = useState(false);
  const [carForm, setCarForm] = useState<Partial<Car>>({});
  const [savingCar, setSavingCar] = useState(false);

  // Finance state
  const [showAddFinance, setShowAddFinance] = useState(false);
  const [financeForm, setFinanceForm] = useState({
    type: "expense", category: "car_purchase", description: "", amount: "",
    entry_date: new Date().toISOString().slice(0, 10), notes: "",
    vat_claimable: false, off_the_records: false,
  });
  const [savingFinance, setSavingFinance] = useState(false);
  const [editingFinance, setEditingFinance] = useState<FinanceEntry | null>(null);

  // Record state
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({
    doc_type: "other", doc_label: "", storage_ref: "", notes: "",
  });
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [savingRecord, setSavingRecord] = useState(false);

  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/inventory/${id}`);
    if (!res.ok) { router.push("/inventory"); return; }
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // ── Car edit ──
  function startEditCar() {
    if (!data) return;
    const c = data.car;
    setCarForm({
      reg: c.reg, car_name: c.car_name, colour: c.colour,
      mileage_bought: c.mileage_bought, purchase_price: c.purchase_price,
      purchase_date: c.purchase_date ?? "", status: c.status,
      location: c.location ?? "", notes: c.notes ?? "",
    });
    setEditingCar(true);
  }

  async function saveCar(e: React.FormEvent) {
    e.preventDefault();
    setSavingCar(true);
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(carForm),
    });
    setSavingCar(false);
    setEditingCar(false);
    load();
  }

  // ── Finance ──
  async function saveFinance(e: React.FormEvent) {
    e.preventDefault();
    setSavingFinance(true);
    if (editingFinance) {
      await fetch("/api/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingFinance.id, ...financeForm, amount: parseFloat(financeForm.amount) }),
      });
      setEditingFinance(null);
    } else {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...financeForm, amount: parseFloat(financeForm.amount), inventory_id: id }),
      });
      setShowAddFinance(false);
    }
    setSavingFinance(false);
    setFinanceForm({ type: "expense", category: "car_purchase", description: "", amount: "", entry_date: new Date().toISOString().slice(0, 10), notes: "", vat_claimable: false, off_the_records: false });
    load();
  }

  function startEditFinance(f: FinanceEntry) {
    setFinanceForm({
      type: f.type, category: f.category, description: f.description,
      amount: String(f.amount), entry_date: f.entry_date, notes: f.notes ?? "",
      vat_claimable: f.vat_claimable, off_the_records: f.off_the_records,
    });
    setEditingFinance(f);
    setShowAddFinance(false);
  }

  async function deleteFinance(fId: number) {
    if (!confirm("Delete this finance entry?")) return;
    await fetch("/api/finance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fId }) });
    load();
  }

  // ── Records ──
  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setSavingRecord(true);
    let file_path: string | null = null;
    if (recordFile) {
      const fd = new FormData();
      fd.append("file", recordFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      file_path = d.path;
    }
    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...recordForm, file_path, inventory_id: parseInt(id) }),
    });
    setSavingRecord(false);
    setShowAddRecord(false);
    setRecordForm({ doc_type: "other", doc_label: "", storage_ref: "", notes: "" });
    setRecordFile(null);
    load();
  }

  async function deleteRecord(rId: number) {
    if (!confirm("Delete this document?")) return;
    await fetch("/api/records", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rId }) });
    load();
  }

  async function deleteCar() {
    if (!confirm("Delete this car from inventory? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    router.push("/inventory");
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
  const { car, finance, records, profit } = data;
  const ff = (key: keyof typeof financeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFinanceForm({ ...financeForm, [key]: e.target.value });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inventory" className="text-sm text-blue-600 hover:underline">← Inventory</Link>
          <h2 className="text-2xl font-bold mt-1">{car.reg}{car.car_name ? ` — ${car.car_name}` : ""}</h2>
        </div>
        <div className="flex gap-2">
          {!editingCar && (
            <button onClick={startEditCar} className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700">
              Edit Car
            </button>
          )}
          <button onClick={deleteCar} disabled={deleting}
            className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      {/* ── Car details ── */}
      <div className="bg-white rounded-lg border p-5">
        {editingCar ? (
          <form onSubmit={saveCar} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {([
                { label: "Reg", key: "reg", type: "text" },
                { label: "Car Name", key: "car_name", type: "text" },
                { label: "Colour", key: "colour", type: "text" },
                { label: "Mileage", key: "mileage_bought", type: "number" },
                { label: "Purchase Price (£)", key: "purchase_price", type: "number" },
                { label: "Purchase Date", key: "purchase_date", type: "date" },
                { label: "Location", key: "location", type: "text" },
              ] as { label: string; key: keyof typeof carForm; type: string }[]).map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input type={type} value={(carForm[key] as string | number | undefined) ?? ""}
                    onChange={(e) => setCarForm({ ...carForm, [key]: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={carForm.status} onChange={(e) => setCarForm({ ...carForm, status: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea value={carForm.notes ?? ""} onChange={(e) => setCarForm({ ...carForm, notes: e.target.value })}
                  rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingCar(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={savingCar} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingCar ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Reg", value: <span className="font-mono font-semibold">{car.reg}</span> },
              { label: "Car", value: car.car_name ?? "—" },
              { label: "Colour", value: car.colour ?? "—" },
              { label: "Mileage", value: car.mileage_bought?.toLocaleString() ?? "—" },
              { label: "Purchase Price", value: fmt(car.purchase_price) },
              { label: "Purchase Date", value: car.purchase_date ? new Date(car.purchase_date).toLocaleDateString("en-GB") : "—" },
              { label: "Location", value: car.location ?? "—" },
              { label: "Linked Lead", value: car.lead_name ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="mt-0.5">{value}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[car.status] ?? "bg-gray-100"}`}>
                {car.status}
              </span>
            </div>
            {car.notes && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-gray-400">Notes</p>
                <p className="text-gray-700 mt-0.5">{car.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── P&L summary ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Income", value: finance.filter(f => f.type === "income").reduce((s, f) => s + Number(f.amount), 0), color: "text-green-600" },
          { label: "Total Expenses", value: finance.filter(f => f.type === "expense").reduce((s, f) => s + Number(f.amount), 0), color: "text-red-600" },
          { label: "Profit", value: profit, color: profit >= 0 ? "text-green-700" : "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border p-4 text-center">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* ── Finance entries ── */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Finance Entries</h3>
          <button onClick={() => { setShowAddFinance(true); setEditingFinance(null); }}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            + Add Entry
          </button>
        </div>

        {/* Add / Edit finance form */}
        {(showAddFinance || editingFinance) && (
          <form onSubmit={saveFinance} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3 border">
            <p className="text-xs font-bold text-gray-500 uppercase">{editingFinance ? "Edit Entry" : "New Entry"}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={financeForm.type} onChange={(e) => {
                  const t = e.target.value;
                  setFinanceForm({ ...financeForm, type: t, category: t === "expense" ? "car_purchase" : "car_sale", vat_claimable: false, off_the_records: false });
                }}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select value={financeForm.category} onChange={ff("category")}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {(financeForm.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount (£)</label>
                <input required type="number" step="0.01" value={financeForm.amount} onChange={ff("amount")}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input required value={financeForm.description} onChange={ff("description")}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={financeForm.entry_date} onChange={ff("entry_date")}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input value={financeForm.notes} onChange={ff("notes")}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              {financeForm.type === "expense" && (
                <div className="col-span-2 md:col-span-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={financeForm.vat_claimable}
                      onChange={(e) => setFinanceForm({ ...financeForm, vat_claimable: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-gray-700">VAT claimable</span>
                  </label>
                </div>
              )}
              {financeForm.type === "income" && (
                <div className="col-span-2 md:col-span-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={financeForm.off_the_records}
                      onChange={(e) => setFinanceForm({ ...financeForm, off_the_records: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-gray-600" />
                    <span className="text-sm text-gray-700">Off the records</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAddFinance(false); setEditingFinance(null); }}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={savingFinance}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingFinance ? "Saving…" : editingFinance ? "Save Changes" : "Add Entry"}
              </button>
            </div>
          </form>
        )}

        {finance.length === 0 && !showAddFinance ? (
          <p className="text-sm text-gray-400">No finance entries yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="pb-2 text-left pr-4">Date</th>
                <th className="pb-2 text-left pr-4">Type</th>
                <th className="pb-2 text-left pr-4">Category</th>
                <th className="pb-2 text-left pr-4">Description</th>
                <th className="pb-2 text-right pr-4">Amount</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {finance.map((f) => (
                <tr key={f.id} className={editingFinance?.id === f.id ? "bg-blue-50" : ""}>
                  <td className="py-2 pr-4 text-gray-400">{new Date(f.entry_date).toLocaleDateString("en-GB")}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${f.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{f.category}</td>
                  <td className="py-2 pr-4">
                    {f.description}
                    {f.notes && <span className="text-xs text-gray-400 ml-1">— {f.notes}</span>}
                    {f.vat_claimable && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">VAT</span>}
                    {f.off_the_records && <span className="ml-2 text-xs">🔒</span>}
                  </td>
                  <td className={`py-2 pr-4 text-right font-medium ${f.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {f.type === "expense" ? "−" : "+"}{fmt(Number(f.amount))}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button onClick={() => startEditFinance(f)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => deleteFinance(f.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Official Records ── */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Documents</h3>
          <button onClick={() => setShowAddRecord(!showAddRecord)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            + Add Document
          </button>
        </div>

        {/* Add record form */}
        {showAddRecord && (
          <form onSubmit={saveRecord} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3 border">
            <p className="text-xs font-bold text-gray-500 uppercase">New Document</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={recordForm.doc_type} onChange={(e) => setRecordForm({ ...recordForm, doc_type: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Label *</label>
                <input required value={recordForm.doc_label} onChange={(e) => setRecordForm({ ...recordForm, doc_label: e.target.value })}
                  placeholder="e.g. V5C — AB12 CDE"
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Upload File</label>
                <input type="file" onChange={(e) => setRecordFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm border rounded px-2 py-1.5" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Or External URL</label>
                <input type="url" value={recordForm.storage_ref} onChange={(e) => setRecordForm({ ...recordForm, storage_ref: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddRecord(false)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={savingRecord} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingRecord ? "Uploading…" : "Save Document"}
              </button>
            </div>
          </form>
        )}

        {records.length === 0 && !showAddRecord ? (
          <p className="text-sm text-gray-400">No documents yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                <div>
                  <span className="font-medium">{r.doc_label}</span>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">{r.doc_type}</span>
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  {r.file_path && (
                    <a href={r.file_path} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">Download</a>
                  )}
                  {r.storage_ref && (
                    <a href={r.storage_ref} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">External Link</a>
                  )}
                  <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                  <button onClick={() => deleteRecord(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
