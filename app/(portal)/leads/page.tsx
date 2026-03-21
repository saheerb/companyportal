"use client";

import { useEffect, useState, useCallback } from "react";

type Lead = {
  id: number;
  name: string;
  email: string;
  phone: string;
  reg: string;
  car_name: string;
  mileage: number;
  valuation: number;
  auction_value: number | null;
  display_auction_value: number | null;
  trade_retail: number | null;
  trade_average: number | null;
  trade_poor: number | null;
  private_clean: number | null;
  private_average: number | null;
  part_exchange: number | null;
  list_price: number | null;
  autotrader_price: number | null;
  autotrader_retail_price: number | null;
  motors_price: number | null;
  wbac_price: number | null;
  scrap_price: number | null;
  offered_price: number | null;
  status: string;
  notes: string | null;
  address: string | null;
  activity_log: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  fbclid: string | null;
};

type LogEntry = { id: string; ts: string; msg: string; note?: string };

const STATUS_GROUPS = [
  {
    label: "Calling",
    color: "bg-blue-500",
    statuses: ["Called - No Answer", "Called - Voicemail Left", "Called - Callback Req.", "WhatsApp Msg Sent", "Check this"],
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
    statuses: ["Offer Declined", "Sold Elsewhere", "Not Worth", "Valuation Check"],
  },
];

const ALL_STATUSES = STATUS_GROUPS.flatMap((g) => g.statuses);
const CLOSED = ["Offer Declined", "Sold Elsewhere", "Not Worth", "Valuation Check", "Sold to Us"];

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

function shownToCustomer(lead: Lead) {
  if (lead.display_auction_value != null) return lead.display_auction_value;
  if (lead.auction_value != null) return Math.round(Number(lead.auction_value) * 0.75);
  return null;
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: (updated: Lead) => void }) {
  const [form, setForm] = useState({
    offered_price: lead.offered_price ?? "",
    autotrader_price: lead.autotrader_price ?? "",
    autotrader_retail_price: lead.autotrader_retail_price ?? "",
    motors_price: lead.motors_price ?? "",
    wbac_price: lead.wbac_price ?? "",
    scrap_price: lead.scrap_price ?? "",
    address: lead.address ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/leads", {
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
            <h3 className="font-bold text-lg">{lead.reg}</h3>
            <p className="text-sm text-gray-500">{lead.name} · {lead.car_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          {/* Offered price */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Offered Price (£)</label>
            <input type="number" step="1" value={form.offered_price} onChange={f("offered_price")}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0" />
          </div>

          {/* Competitor prices */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Competitor Prices</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "AutoTrader PX", key: "autotrader_price" as const },
                { label: "AutoTrader Retail", key: "autotrader_retail_price" as const },
                { label: "Motors", key: "motors_price" as const },
                { label: "WBAC", key: "wbac_price" as const },
                { label: "Scrap", key: "scrap_price" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label} (£)</label>
                  <input type="number" step="1" value={form[key]} onChange={f(key)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Address</label>
            <input type="text" value={form.address} onChange={f("address")}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
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
function LogActionModal({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: (updated: Lead) => void }) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!note.trim() && !selectedStatus) return;
    setSaving(true);
    const newStatus = selectedStatus ?? lead.status;
    const msg = selectedStatus && selectedStatus !== lead.status
      ? `Status changed to "${selectedStatus}"`
      : note.trim() || "Note added";
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        ...(selectedStatus && selectedStatus !== lead.status ? { status: newStatus } : {}),
        log_add: { msg, note: selectedStatus ? (note || undefined) : undefined },
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
          <h3 className="font-bold">Log Action — {lead.reg}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-400">Current status: <span className="font-semibold text-gray-600">{lead.status || "New"}</span> — select a new status below, or just add a note.</p>
          {STATUS_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.statuses.map((s) => (
                  <button key={s} onClick={() => setSelectedStatus(selectedStatus === s ? null : s)}
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
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Note {selectedStatus ? "(optional)" : "(required)"}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder={selectedStatus ? "Add a note…" : "What happened?"}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving || (!note.trim() && !selectedStatus)} className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm hover:bg-gray-800 disabled:opacity-50 font-medium">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Smart Offer Panel ─────────────────────────────────────────────────────────
type SmartOfferResult = {
  smartOffer: number;
  estimatedWbac: number;
  wbacRatio: number;
  confidence: "high" | "medium" | "low";
  bandDataPoints: number;
  ageBand: string | null;
  mileageBand: string | null;
  apiValue: number;
  margin: number;
  estimatedAtPx?: number;
  atPxRatio?: number;
  atPxDataPoints?: number;
  estimatedAtRetail?: number;
  atRetailRatio?: number;
  atRetailDataPoints?: number;
};

function SmartOfferPanel({ leadId }: { leadId: number }) {
  const [data, setData] = useState<SmartOfferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (data || loading) { setOpen(true); return; }
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch(`/api/smart-valuation?id=${leadId}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed"); }
      else { setData(json); }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const confidenceColor = {
    high: "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="px-4 pb-3">
      <button
        onClick={open ? () => setOpen(false) : load}
        className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 hover:text-gray-600"
      >
        <span>Smart Offer</span>
        <span className="text-gray-300">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs">
          {loading && <p className="text-gray-400 italic">Calculating…</p>}
          {error && <p className="text-red-500">{error}</p>}
          {data && (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-indigo-900">Smart Offer</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${confidenceColor[data.confidence]}`}>
                  {data.confidence} confidence
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">API value</span>
                  <span className="font-medium">{fmt(data.apiValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Est. WBAC
                    <span className="text-gray-400 ml-1">
                      ({Math.round(data.wbacRatio * 100)}% of API
                      {data.bandDataPoints > 0 ? `, ${data.bandDataPoints} similar car${data.bandDataPoints !== 1 ? "s" : ""}` : ""})
                    </span>
                  </span>
                  <span className="font-medium">{fmt(data.estimatedWbac)}</span>
                </div>
                <div className="flex justify-between border-t border-indigo-200 pt-1.5 mt-1">
                  <span className="font-bold text-indigo-800">Our offer (+£{data.margin})</span>
                  <span className="font-bold text-indigo-900 text-sm">{fmt(data.smartOffer)}</span>
                </div>
                {data.estimatedAtPx != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      AutoTrader PX
                      {data.atPxDataPoints != null && data.atPxDataPoints > 0 && (
                        <span className="text-gray-400 ml-1">({data.atPxDataPoints} car{data.atPxDataPoints !== 1 ? "s" : ""})</span>
                      )}
                    </span>
                    <span className="font-medium">{fmt(data.estimatedAtPx)}</span>
                  </div>
                )}
                {data.estimatedAtRetail != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      AutoTrader Retail
                      {data.atRetailDataPoints != null && data.atRetailDataPoints > 0 && (
                        <span className="text-gray-400 ml-1">({data.atRetailDataPoints} car{data.atRetailDataPoints !== 1 ? "s" : ""})</span>
                      )}
                    </span>
                    <span className="font-medium">{fmt(data.estimatedAtRetail)}</span>
                  </div>
                )}
              </div>
              {(data.ageBand || data.mileageBand) && (
                <p className="text-gray-400 mt-2">
                  {data.ageBand && <>Age band: <span className="text-gray-600">{data.ageBand}</span></>}
                  {data.ageBand && data.mileageBand && " · "}
                  {data.mileageBand && <>Mileage band: <span className="text-gray-600">{data.mileageBand}</span></>}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead: initialLead, onUpdate, onDelete }: { lead: Lead; onUpdate: (l: Lead) => void; onDelete: (id: number) => void }) {
  const [lead, setLead] = useState(initialLead);
  const [showEdit, setShowEdit] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [atLoading, setAtLoading] = useState(false);
  const [atError, setAtError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => { setLead(initialLead); }, [initialLead]);

  const log: LogEntry[] = (() => { try { return JSON.parse(lead.activity_log || "[]"); } catch { return []; } })();
  const shown = shownToCustomer(lead);

  function handleSaved(updated: Lead) { setLead(updated); onUpdate(updated); }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/leads?id=${lead.id}`, { method: "DELETE" });
    onDelete(lead.id);
  }

  async function fetchAtValuation() {
    setAtLoading(true);
    setAtError(null);
    try {
      const res = await fetch("/api/at-valuate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json();
      if (!res.ok) { setAtError(data.error || "Failed"); return; }
      setLead(l => ({ ...l, autotrader_retail_price: data.retail, autotrader_price: data.trade }));
    } catch {
      setAtError("Network error");
    } finally {
      setAtLoading(false);
    }
  }


  async function deleteLogEntry(entryId: string) {
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, log_delete: entryId }),
    });
    handleSaved(await res.json());
  }

  async function saveEditEntry(entry: LogEntry) {
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, log_edit: { id: entry.id, msg: editText.trim() || entry.msg, note: undefined } }),
    });
    handleSaved(await res.json());
    setEditingEntry(null);
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="p-4 pb-3">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg tracking-wide">{lead.reg}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${statusColor(lead.status)}`}>
                {lead.status || "New"}
              </span>
            </div>
            <div className="flex gap-1.5 shrink-0 ml-2">
              <button onClick={() => setShowEdit(true)}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                Edit
              </button>
              {confirmDelete ? (
                <>
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
                    {deleting ? "…" : "Confirm"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-xs border border-gray-300 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="text-xs border border-red-200 text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600">
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span className="font-medium text-gray-700">{lead.name}</span>
            <span className="text-xs">{new Date(lead.created_at).toLocaleDateString("en-GB")}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <a href={`mailto:${lead.email}`} className="text-blue-500 hover:underline">{lead.email}</a>
            {lead.phone && (
              <div className="flex items-center gap-2">
                <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
                <a href={`https://wa.me/44${lead.phone.replace(/^\+44/, "").replace(/^0/, "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                  className="text-green-500 hover:text-green-600" title="WhatsApp">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              </div>
            )}
          </div>
          {lead.car_name && (
            <p className="text-xs text-gray-400 mt-1">
              {lead.car_name}{lead.mileage ? ` · ${Number(lead.mileage).toLocaleString("en-GB")} mi` : ""}
            </p>
          )}
          {lead.address && <p className="text-xs text-gray-400 mt-0.5">{lead.address}</p>}
          {(() => {
            const src = lead.utm_source?.toLowerCase();
            const med = lead.utm_medium?.toLowerCase();
            const isPaidGoogle = (src === 'google' && med === 'cpc') || (!src && !!lead.gclid);
            const isOrgGoogle  = src === 'google' && med !== 'cpc';
            const isFb         = src === 'fb' || src === 'facebook' || (!src && !!lead.fbclid);
            const isIg         = src === 'ig' || src === 'instagram';
            const isDirect     = !src && !lead.gclid && !lead.fbclid;

            const label = isPaidGoogle ? 'Paid Google'
                        : isOrgGoogle  ? 'Google'
                        : isFb         ? 'FB'
                        : isIg         ? 'IG'
                        : isDirect     ? 'Direct'
                        : src ?? null;

            const style = isPaidGoogle || isOrgGoogle ? 'bg-blue-100 text-blue-700'
                        : isFb || isIg               ? 'bg-indigo-100 text-indigo-700'
                        : isDirect                   ? 'bg-gray-100 text-gray-400'
                        :                              'bg-gray-100 text-gray-600';

            return label ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${style}`}>
                  {label}
                </span>
                {lead.utm_campaign && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-gray-100 text-gray-500">
                    {lead.utm_campaign}
                  </span>
                )}
              </div>
            ) : null;
          })()}
        </div>

        {/* Offered price banner */}
        {lead.offered_price != null && (
          <div className="mx-4 mb-3 bg-gray-900 text-white rounded-lg px-3 py-2 flex justify-between items-center">
            <span className="text-xs uppercase tracking-wide opacity-70">Offered Price</span>
            <span className="font-bold text-green-400 text-base">{fmt(lead.offered_price)}</span>
          </div>
        )}

        {/* Valuations */}
        <div className="px-4 pb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Valuations</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Shown to Customer", value: shown, highlight: true },
              { label: "Auction (API)", value: lead.auction_value },
              { label: "Trade Retail", value: lead.trade_retail },
              { label: "Trade Avg", value: lead.trade_average },
              { label: "Trade Poor", value: lead.trade_poor },
              { label: "Private Clean", value: lead.private_clean },
              { label: "Private Avg", value: lead.private_average },
              { label: "Part Exchange", value: lead.part_exchange },
              { label: "Dealer Retail", value: lead.valuation },
              { label: "List Price", value: lead.list_price },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-lg p-2 ${highlight ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                <p className={`font-bold text-sm mt-0.5 ${highlight ? "text-green-700" : ""}`}>{fmt(value ?? null)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor prices */}
        {lead.auction_value != null && (
          <div className="px-4 pb-2">
            <button
              onClick={fetchAtValuation}
              disabled={atLoading}
              className="text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 font-medium"
            >
              {atLoading ? "Fetching AT prices…" : "Fetch AT Retail + Trade"}
            </button>
            {atError && <p className="text-xs text-red-500 mt-1">{atError}</p>}
          </div>
        )}
        {(lead.autotrader_price || lead.autotrader_retail_price || lead.motors_price || lead.wbac_price || lead.scrap_price) && (
          <div className="px-4 pb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Competitor Prices</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "AutoTrader PX", value: lead.autotrader_price },
                { label: "AutoTrader Retail", value: lead.autotrader_retail_price },
                { label: "Motors", value: lead.motors_price },
                { label: "WBAC", value: lead.wbac_price },
                { label: "Scrap", value: lead.scrap_price },
              ].filter(x => x.value != null).map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                  <p className="font-bold text-sm mt-0.5">{fmt(value ?? null)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Offer */}
        {lead.auction_value != null && <SmartOfferPanel leadId={lead.id} />}

        {/* Notes */}
        {lead.notes && (
          <div className="mx-4 mb-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-3 py-2 text-sm text-gray-600">
            {lead.notes}
          </div>
        )}

        {/* Activity log */}
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <div className="mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Activity Log</p>
          </div>

          <div className="space-y-1.5">
            {log.length === 0 ? (
              <p className="text-xs text-gray-300 italic">No activity yet</p>
            ) : (
              [...log].reverse().map((entry) => (
                <div key={entry.id} className="flex gap-2 text-xs group">
                  <span className="text-gray-300 shrink-0 pt-0.5">
                    {new Date(entry.ts).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1">
                    <span className="text-gray-600">{entry.msg}</span>
                    {editingEntry === entry.id ? (
                      <div className="flex gap-1 mt-1">
                        <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEditEntry(entry); if (e.key === "Escape") setEditingEntry(null); }}
                          placeholder="Edit note…"
                          className="flex-1 border rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        <button onClick={() => saveEditEntry(entry)} className="text-blue-600 hover:underline">Save</button>
                        <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <span className="text-gray-400">
                        {entry.note && ` — ${entry.note}`}
                        <button onClick={() => { setEditingEntry(entry.id); setEditText(entry.note ?? entry.msg); }}
                          className="opacity-0 group-hover:opacity-100 ml-1 text-blue-400 hover:text-blue-600 transition-opacity">✎</button>
                      </span>
                    )}
                  </div>
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
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideClosed, setHideClosed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/leads?${params}`);
    setLeads(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  function handleDelete(id: number) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  const visible = hideClosed ? leads.filter((l) => !CLOSED.includes(l.status)) : leads;
  const closedCount = leads.filter((l) => CLOSED.includes(l.status)).length;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <p className="text-sm text-gray-500">{visible.length} showing · {leads.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search name, reg, email…"
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
              <div className="h-5 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-100 rounded w-40" />
              <div className="h-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No leads found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
