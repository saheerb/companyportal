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
  date: string;
  time: string;
  status: string;
};

function statusBadge(s: string) {
  if (s === "confirmed") return "bg-green-100 text-green-800";
  if (s === "cancelled") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

function formatDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelling, setCancelling] = useState<number | null>(null);

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

  async function cancelAppointment(id: number) {
    if (!confirm("Cancel this appointment?")) return;
    setCancelling(id);
    await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "cancelled" }),
    });
    setCancelling(null);
    load();
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
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
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
                {["Date", "Time", "Name", "Phone", "Reg", "Address", "Note", "Status", ""].map((h) => (
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
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{a.note || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {a.status === "confirmed" && (
                      <button
                        onClick={() => cancelAppointment(a.id)}
                        disabled={cancelling === a.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {cancelling === a.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
