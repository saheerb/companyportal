"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  created_at: string;
  lead_name: string | null;
};

const STATUSES = ["Bought", "Being Prepped", "Listed for Sale", "Sold"];

const statusColors: Record<string, string> = {
  "Bought": "bg-blue-100 text-blue-700",
  "Being Prepped": "bg-yellow-100 text-yellow-700",
  "Listed for Sale": "bg-purple-100 text-purple-700",
  "Sold": "bg-green-100 text-green-700",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function AddCarModal({
  onClose,
  onSaved,
  prefill,
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: Record<string, string>;
}) {
  const [form, setForm] = useState({
    reg: prefill?.reg ?? "",
    car_name: prefill?.car_name ?? "",
    colour: "",
    mileage_bought: prefill?.mileage_bought ?? "",
    purchase_price: prefill?.purchase_price ?? "",
    purchase_date: "",
    status: "Bought",
    location: "",
    notes: "",
    lead_id: prefill?.lead_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Add Car to Inventory</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reg *</label>
              <input required value={form.reg} onChange={(e) => setForm({ ...form, reg: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Car Name</label>
              <input value={form.car_name} onChange={(e) => setForm({ ...form, car_name: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colour</label>
              <input value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mileage</label>
              <input type="number" value={form.mileage_bought} onChange={(e) => setForm({ ...form, mileage_bought: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Price (£)</label>
              <input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Add Car"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCarModal({ car, onClose, onSaved }: { car: Car; onClose: () => void; onSaved: (updated: Car) => void }) {
  const [form, setForm] = useState({
    reg: car.reg,
    car_name: car.car_name ?? "",
    colour: car.colour ?? "",
    mileage_bought: car.mileage_bought != null ? String(car.mileage_bought) : "",
    purchase_price: car.purchase_price != null ? String(car.purchase_price) : "",
    purchase_date: car.purchase_date ?? "",
    status: car.status,
    location: car.location ?? "",
    notes: car.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: car.id, ...form }),
    });
    const updated = await res.json();
    setSaving(false);
    onSaved(updated);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit — {car.reg}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reg *</label>
              <input required value={form.reg} onChange={f("reg")}
                className="w-full border rounded px-2 py-1.5 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Car Name</label>
              <input value={form.car_name} onChange={f("car_name")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colour</label>
              <input value={form.colour} onChange={f("colour")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mileage</label>
              <input type="number" value={form.mileage_bought} onChange={f("mileage_bought")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Price (£)</label>
              <input type="number" value={form.purchase_price} onChange={f("purchase_price")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={f("purchase_date")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={f("status")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input value={form.location} onChange={f("location")}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={f("notes")} rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryContent() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const prefill = searchParams.get("reg")
    ? Object.fromEntries(searchParams.entries())
    : undefined;

  useEffect(() => {
    if (prefill) setShowModal(true);
  }, []);

  const loadCars = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/inventory?${params}`);
    setCars(await res.json());
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { loadCars(); }, [loadCars]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
          <p className="text-sm text-gray-500">{cars.length} cars</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          + Add Car
        </button>
      </div>

      {/* Pipeline filter bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium border ${!statusFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${statusFilter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
          >
            {s}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search reg or car…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto border border-gray-300 rounded-md px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
                <th className="px-4 py-3">Reg</th>
                <th className="px-4 py-3">Car</th>
                <th className="px-4 py-3">Colour</th>
                <th className="px-4 py-3">Mileage</th>
                <th className="px-4 py-3">Purchase Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cars.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No cars found.</td></tr>
              ) : cars.map((car) => (
                <tr key={car.id} onClick={() => router.push(`/inventory/${car.id}`)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{car.reg}</td>
                  <td className="px-4 py-3">{car.car_name}</td>
                  <td className="px-4 py-3 text-gray-500">{car.colour}</td>
                  <td className="px-4 py-3 text-gray-500">{car.mileage_bought?.toLocaleString()}</td>
                  <td className="px-4 py-3">{fmt(car.purchase_price)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[car.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {car.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{car.location}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{car.lead_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(car.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddCarModal
          onClose={() => { setShowModal(false); router.replace("/inventory"); }}
          onSaved={loadCars}
          prefill={prefill}
        />
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryContent />
    </Suspense>
  );
}
