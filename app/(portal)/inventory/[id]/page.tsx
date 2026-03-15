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
};

type Record_ = {
  id: number;
  doc_type: string;
  doc_label: string;
  file_path: string | null;
  storage_ref: string | null;
  created_at: string;
};

const STATUSES = ["Bought", "Being Prepped", "Listed for Sale", "Sold"];
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
  const [statusEdit, setStatusEdit] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/inventory/${id}`);
    if (!res.ok) { router.push("/inventory"); return; }
    const d = await res.json();
    setData(d);
    setNewStatus(d.car.status);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus() {
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusEdit(false);
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inventory" className="text-sm text-blue-600 hover:underline">← Inventory</Link>
          <h2 className="text-2xl font-bold mt-1">
            {car.reg} {car.car_name && `— ${car.car_name}`}
          </h2>
        </div>
        <button
          onClick={deleteCar}
          disabled={deleting}
          className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      {/* Car details */}
      <div className="bg-white rounded-lg border p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">Reg</p>
          <p className="font-mono font-semibold">{car.reg}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Car</p>
          <p>{car.car_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Colour</p>
          <p>{car.colour ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Mileage (bought)</p>
          <p>{car.mileage_bought?.toLocaleString() ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Purchase Price</p>
          <p>{fmt(car.purchase_price)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Purchase Date</p>
          <p>{car.purchase_date ? new Date(car.purchase_date).toLocaleDateString("en-GB") : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Location</p>
          <p>{car.location ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Linked Lead</p>
          <p>{car.lead_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Status</p>
          {statusEdit ? (
            <div className="flex gap-2 mt-1">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="border rounded px-2 py-0.5 text-sm"
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button onClick={updateStatus} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Save</button>
              <button onClick={() => setStatusEdit(false)} className="text-xs border px-2 py-0.5 rounded">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[car.status] ?? "bg-gray-100"}`}>
                {car.status}
              </span>
              <button onClick={() => setStatusEdit(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
            </div>
          )}
        </div>
        {car.notes && (
          <div className="col-span-4">
            <p className="text-xs text-gray-400">Notes</p>
            <p className="text-gray-700">{car.notes}</p>
          </div>
        )}
      </div>

      {/* Profit summary */}
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

      {/* Finance entries */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Finance Entries</h3>
          <Link href={`/finance?inventory_id=${car.id}`} className="text-xs text-blue-600 hover:underline">
            View in Finance →
          </Link>
        </div>
        {finance.length === 0 ? (
          <p className="text-sm text-gray-400">No finance entries linked to this car.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="pb-2 text-left pr-4">Date</th>
                <th className="pb-2 text-left pr-4">Type</th>
                <th className="pb-2 text-left pr-4">Category</th>
                <th className="pb-2 text-left pr-4">Description</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {finance.map((f) => (
                <tr key={f.id}>
                  <td className="py-2 pr-4 text-gray-400">{new Date(f.entry_date).toLocaleDateString("en-GB")}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${f.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{f.category}</td>
                  <td className="py-2 pr-4">{f.description}</td>
                  <td className={`py-2 text-right font-medium ${f.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {f.type === "expense" ? "−" : "+"}{fmt(Number(f.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Official Records */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Official Records</h3>
          <Link href={`/records?inventory_id=${car.id}`} className="text-xs text-blue-600 hover:underline">
            View in Records →
          </Link>
        </div>
        {records.length === 0 ? (
          <p className="text-sm text-gray-400">No documents linked to this car.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                <div>
                  <span className="font-medium">{r.doc_label}</span>
                  <span className="ml-2 text-xs text-gray-400">{r.doc_type}</span>
                </div>
                <div className="flex gap-3">
                  {r.file_path && (
                    <a href={r.file_path} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                      Download
                    </a>
                  )}
                  {r.storage_ref && (
                    <a href={r.storage_ref} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                      External Link
                    </a>
                  )}
                  <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
