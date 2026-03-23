"use client";

import { useEffect, useState, useCallback } from "react";

type Appointment = {
  id: number;
  created_at: string;
  lead_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  reg: string | null;
  address: string | null;
  postcode: string | null;
  note: string | null;
  notes: string | null;
  date: string;
  time: string;
  status: string;
};

const STATUS_OPTIONS = ["confirmed", "done", "cancelled"];

function statusBadge(s: string) {
  if (s === "confirmed") return "bg-green-100 text-green-800";
  if (s === "done")      return "bg-blue-100 text-blue-800";
  if (s === "cancelled") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

function formatDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: (updated: Appointment) => void }) {
  const [form, setForm] = useState({
    date:   appt.date,
    time:   appt.time,
    status: appt.status,
    notes:  appt.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: appt.id, ...form }),
    });
    const updated = await res.json();
    setSaving(false);
    onSaved(updated);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg">{appt.name}</h3>
            <p className="text-sm text-gray-500">{appt.reg || "No reg"} · {appt.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Date</label>
              <input type="date" value={form.date} onChange={f("date")} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Time</label>
              <input type="time" value={form.time} onChange={f("time")} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select value={form.status} onChange={f("status")}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.notes} onChange={f("notes")} rows={3}
              placeholder="Add internal notes…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((d) => { setAppointments(d); setLoading(false); });
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(updated: Appointment) {
    setAppointments((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <p className="text-sm text-gray-500 mt-1">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, reg, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No appointments found</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Date", "Time", "Name", "Phone", "Reg", "Address", "Customer Note", "Notes", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{formatDate(a.date)}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{a.time}</td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    <div>{a.name}</div>
                    <div className="text-xs text-gray-400">{a.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{a.phone || "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">{a.reg || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {a.address ? <>{a.address}{a.postcode ? `, ${a.postcode}` : ""}</> : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{a.note || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs max-w-[160px] truncate">{a.notes || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setEditing(a)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          appt={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
