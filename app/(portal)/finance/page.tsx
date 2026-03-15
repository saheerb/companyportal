"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Entry = {
  id: number;
  type: string;
  category: string;
  description: string;
  amount: number;
  entry_date: string;
  car_reg: string | null;
  car_name: string | null;
  notes: string | null;
};

type Car = { id: number; reg: string; car_name: string };

const CATEGORIES = ["car_sale", "purchase", "repair", "fee", "other"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function AddEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: "income",
    category: "car_sale",
    description: "",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    inventory_id: "",
    notes: "",
  });
  const [cars, setCars] = useState<Car[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(setCars);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Add Finance Entry</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
              <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (£) *</label>
              <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Add Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FinanceContent() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const searchParams = useSearchParams();
  const inventoryId = searchParams.get("inventory_id");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (inventoryId) params.set("inventory_id", inventoryId);
    const res = await fetch(`/api/finance?${params}`);
    setEntries(await res.json());
    setLoading(false);
  }, [inventoryId]);

  useEffect(() => { load(); }, [load]);

  async function deleteEntry(id: number) {
    if (!confirm("Delete this entry?")) return;
    await fetch("/api/finance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthEntries = entries.filter((e) => e.entry_date.slice(0, 7) === thisMonth);
  const monthIncome = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Finance</h2>
          {inventoryId && <p className="text-sm text-blue-600">Filtered by car</p>}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          + Add Entry
        </button>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-xs text-gray-400">This Month Income</p>
          <p className="text-2xl font-bold text-green-600">{fmt(monthIncome)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-xs text-gray-400">This Month Expenses</p>
          <p className="text-2xl font-bold text-red-600">{fmt(monthExpenses)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-xs text-gray-400">This Month Profit</p>
          <p className={`text-2xl font-bold ${monthIncome - monthExpenses >= 0 ? "text-green-700" : "text-red-600"}`}>
            {fmt(monthIncome - monthExpenses)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b text-left text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Car</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No entries found.</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{new Date(e.entry_date).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.category}</td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.car_reg}</td>
                  <td className={`px-4 py-3 text-right font-medium ${e.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {e.type === "expense" ? "−" : "+"}{fmt(Number(e.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteEntry(e.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <AddEntryModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceContent />
    </Suspense>
  );
}
