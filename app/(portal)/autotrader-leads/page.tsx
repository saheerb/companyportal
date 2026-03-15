"use client";

import { useEffect, useState, useCallback } from "react";

type CarLead = {
  id: number;
  listing_id: string;
  listing_url: string | null;
  car_name: string | null;
  year: number | null;
  mileage: number | null;
  price: number | null;
  seller_name: string | null;
  phone: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  activity_log: string | null;
  wbac_price: number | null;
  auction_price: number | null;
  retail_price: number | null;
  scraped_at: string;
};

type LogEntry = { id: string; ts: string; msg: string; note?: string };

const STATUS_GROUPS = [
  {
    label: "Calling",
    color: "bg-blue-500",
    statuses: ["Called - No Answer", "Called - Voicemail Left", "Called - Callback Req."],
  },
  {
    label: "In Progress",
    color: "bg-amber-500",
    statuses: ["Contacted", "Offer Made", "Offer Pending"],
  },
  {
    label: "Won",
    color: "bg-green-600",
    statuses: ["Offer Accepted", "Sold to Us"],
  },
  {
    label: "Closed",
    color: "bg-red-500",
    statuses: ["Offer Declined", "Sold Elsewhere", "Not Worth"],
  },
];

const CLOSED = ["Offer Declined", "Sold Elsewhere", "Not Worth", "Sold to Us"];

function statusColor(s: string) {
  if (!s || s === "New") return "bg-gray-500";
  for (const g of STATUS_GROUPS) {
    if (g.statuses.includes(s)) return g.color;
  }
  return "bg-gray-500";
}

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return "£" + Number(v).toLocaleString("en-GB");
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ lead, onClose, onSaved }: { lead: CarLead; onClose: () => void; onSaved: (updated: CarLead) => void }) {
  const [form, setForm] = useState({
    status: lead.status || "New",
    notes: lead.notes ?? "",
    phone: lead.phone ?? "",
    wbac_price: lead.wbac_price ?? "",
    auction_price: lead.auction_price ?? "",
    retail_price: lead.retail_price ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/autotrader-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, ...form }),
    });
    const updated = await res.json();
    setSaving(false);
    onSaved(updated);
    onClose();
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg">{lead.car_name ?? "Unknown Car"}</h3>
            <p className="text-sm text-gray-500">{lead.year} · {lead.location}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select value={form.status} onChange={f("status")}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="New">New</option>
              {STATUS_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.statuses.map((s) => <option key={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={f("phone")}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. 07700 900123" />
          </div>

          {/* Valuations */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Valuations</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "WBAC (£)", key: "wbac_price" },
                { label: "Auction (£)", key: "auction_price" },
                { label: "Retail (£)", key: "retail_price" },
              ] as { label: string; key: keyof typeof form }[]).map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input type="number" step="1" value={form[key]} onChange={f(key)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.notes} onChange={f("notes")} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log Action Modal ──────────────────────────────────────────────────────────
function LogActionModal({ lead, onClose, onSaved }: { lead: CarLead; onClose: () => void; onSaved: (updated: CarLead) => void }) {
  const [selectedStatus, setSelectedStatus] = useState(lead.status || "New");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const msg = selectedStatus !== lead.status
      ? `Status changed to "${selectedStatus}"`
      : "Note added";
    const res = await fetch("/api/autotrader-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        status: selectedStatus,
        log_add: { msg, note: note || undefined },
      }),
    });
    const updated = await res.json();
    setSaving(false);
    onSaved(updated);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold">Log Action — {lead.car_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {STATUS_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.statuses.map((s) => (
                  <button key={s} onClick={() => setSelectedStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                      selectedStatus === s
                        ? `${g.color} text-white border-transparent`
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Add a note…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm hover:bg-gray-800 disabled:opacity-50 font-medium">
              {saving ? "Saving…" : "Log Action"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Car Lead Card ─────────────────────────────────────────────────────────────
function CarLeadCard({ lead: initialLead, onUpdate }: { lead: CarLead; onUpdate: (l: CarLead) => void }) {
  const [lead, setLead] = useState(initialLead);
  const [showEdit, setShowEdit] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [addNote, setAddNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => { setLead(initialLead); }, [initialLead]);

  const log: LogEntry[] = (() => { try { return JSON.parse(lead.activity_log || "[]"); } catch { return []; } })();

  function handleSaved(updated: CarLead) { setLead(updated); onUpdate(updated); }

  async function submitNote() {
    if (!noteText.trim()) return;
    const res = await fetch("/api/autotrader-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, log_add: { msg: noteText.trim() } }),
    });
    handleSaved(await res.json());
    setNoteText("");
    setAddNote(false);
  }

  async function deleteLogEntry(entryId: string) {
    const res = await fetch("/api/autotrader-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, log_delete: entryId }),
    });
    handleSaved(await res.json());
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="p-4 pb-3">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base">{lead.car_name ?? "Unknown"}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${statusColor(lead.status)}`}>
                {lead.status || "New"}
              </span>
            </div>
            <button onClick={() => setShowEdit(true)}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 shrink-0 ml-2">
              Edit
            </button>
          </div>

          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{new Date(lead.scraped_at).toLocaleDateString("en-GB")}</span>
            {lead.listing_url && (
              <a href={lead.listing_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-500 hover:underline font-medium">
                View listing ↗
              </a>
            )}
          </div>
        </div>

        {/* Car details */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">Price</p>
              <p className="font-bold text-sm mt-0.5">{fmt(lead.price)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">Year</p>
              <p className="font-bold text-sm mt-0.5">{lead.year ?? "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">Mileage</p>
              <p className="font-bold text-sm mt-0.5">
                {lead.mileage != null ? Number(lead.mileage).toLocaleString("en-GB") + " mi" : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">Location</p>
              <p className="font-bold text-sm mt-0.5 truncate">{lead.location ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Seller info */}
        <div className="px-4 pb-3">
          {lead.seller_name && (
            <p className="text-xs text-gray-500 mb-1">Seller: <span className="font-medium text-gray-700">{lead.seller_name}</span></p>
          )}
          {lead.phone
            ? <a href={`tel:${lead.phone}`} className="text-sm text-blue-600 hover:underline font-medium">{lead.phone}</a>
            : <p className="text-xs text-gray-300 italic">No phone — add via Edit</p>
          }
        </div>

        {/* Valuations */}
        {(lead.wbac_price != null || lead.auction_price != null || lead.retail_price != null) && (
          <div className="px-4 pb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Valuations</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "WBAC", value: lead.wbac_price },
                { label: "Auction", value: lead.auction_price },
                { label: "Retail", value: lead.retail_price },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                  <p className="font-bold text-sm mt-0.5">{fmt(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <div className="mx-4 mb-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-3 py-2 text-sm text-gray-600">
            {lead.notes}
          </div>
        )}

        {/* Activity log */}
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Activity Log</p>
            <button onClick={() => setAddNote(!addNote)} className="text-xs text-blue-600 hover:underline font-medium">
              + Add Note
            </button>
          </div>

          {addNote && (
            <div className="mb-3 flex gap-2">
              <input
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNote()}
                placeholder="Type a note and press Enter…"
                className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button onClick={submitNote} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Add</button>
              <button onClick={() => setAddNote(false)} className="text-xs border px-2.5 py-1.5 rounded-lg hover:bg-gray-50">✕</button>
            </div>
          )}

          <div className="space-y-1.5">
            {log.length === 0 ? (
              <p className="text-xs text-gray-300 italic">No activity yet</p>
            ) : (
              [...log].reverse().map((entry) => (
                <div key={entry.id} className="flex gap-2 text-xs group">
                  <span className="text-gray-300 shrink-0 pt-0.5">
                    {new Date(entry.ts).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-gray-600 flex-1">
                    {entry.msg}{entry.note && <span className="text-gray-400"> — {entry.note}</span>}
                  </span>
                  <button onClick={() => deleteLogEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity shrink-0">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <button onClick={() => setShowLog(true)}
            className="mt-3 w-full bg-gray-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-gray-800">
            Log Action
          </button>
        </div>
      </div>

      {showEdit && <EditModal lead={lead} onClose={() => setShowEdit(false)} onSaved={handleSaved} />}
      {showLog && <LogActionModal lead={lead} onClose={() => setShowLog(false)} onSaved={handleSaved} />}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AutoTraderLeadsPage() {
  const [leads, setLeads] = useState<CarLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideClosed, setHideClosed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/autotrader-leads?${params}`);
    setLeads(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(updated: CarLead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  const visible = hideClosed ? leads.filter((l) => !CLOSED.includes(l.status)) : leads;
  const closedCount = leads.filter((l) => CLOSED.includes(l.status)).length;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AutoTrader Leads</h2>
          <p className="text-sm text-gray-500">{visible.length} showing · {leads.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search car, location, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideClosed}
            onChange={(e) => setHideClosed(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          Hide closed leads {closedCount > 0 && <span className="text-gray-400">({closedCount})</span>}
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse space-y-3">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No leads found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((lead) => (
            <CarLeadCard key={lead.id} lead={lead} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
