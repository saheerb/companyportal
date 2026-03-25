"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";

type Car = { id: number; reg: string; car_name: string };

type BankBalance = { id: number; bank_name: string; balance: number; balance_date: string };
type Investment = { id: number; name: string; type: string; amount: number; investment_date: string; notes: string | null };

type Overview = {
  bank_balance: BankBalance | null;
  bank_history: BankBalance[];
  investments: Investment[];
  capital_invested: number;
  stock_value: number;
  cars_in_stock: number;
  total_income: number;
  total_expenses: number;
  off_the_records_balance: number;
};

const EXPENSE_CATEGORIES = ["car_purchase", "repair_service", "parts", "preparation", "delivery", "commission", "other"];
const INCOME_CATEGORIES  = ["car_sale", "other"];
const INVESTMENT_TYPES = ["SEIS", "Personal", "Other"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB");
}

// ─── Bank Balance Modal ────────────────────────────────────────────────────────
function BankModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    bank_name: "",
    balance: "",
    balance_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/finance/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "bank", ...form, balance: parseFloat(form.balance) }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Update Bank Balance</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
            <input required value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="e.g. Starling, Barclays"
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Balance (£) *</label>
            <input required type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
            <input required type="date" value={form.balance_date} onChange={(e) => setForm({ ...form, balance_date: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Investment Modal ──────────────────────────────────────────────────────────
function InvestmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    type: "Personal",
    amount: "",
    investment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/finance/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "investment", ...form, amount: parseFloat(form.amount) }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Add Investment</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name / Description *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. John Smith — SEIS round 1"
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {INVESTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (£) *</label>
              <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
            <input required type="date" value={form.investment_date} onChange={(e) => setForm({ ...form, investment_date: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Add Investment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Entry Modal ───────────────────────────────────────────────────────────
function AddEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: "income",
    category: "car_sale",
    description: "",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    inventory_id: "",
    notes: "",
    vat_claimable: false,
    off_the_records: false,
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
              <select required value={form.type} onChange={(e) => {
                const t = e.target.value;
                setForm({ ...form, type: t, category: t === "expense" ? "car_purchase" : "car_sale", vat_claimable: false, off_the_records: false });
              }}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {(form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
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
            {form.type === "expense" && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.vat_claimable} onChange={(e) => setForm({ ...form, vat_claimable: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">VAT claimable</span>
                </label>
              </div>
            )}
            {form.type === "income" && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.off_the_records} onChange={(e) => setForm({ ...form, off_the_records: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-gray-600" />
                  <span className="text-sm text-gray-700">Off the records</span>
                </label>
              </div>
            )}
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

// ─── Finance Content ───────────────────────────────────────────────────────────
function FinanceContent() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [showBankHistory, setShowBankHistory] = useState(false);
  const [showInvestments, setShowInvestments] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/overview");
    setOverview(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteOverviewItem(entity: string, id: number) {
    if (!confirm("Delete this record?")) return;
    await fetch("/api/finance/overview", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id }) });
    load();
  }

  const netPL = (overview?.total_income ?? 0) - (overview?.total_expenses ?? 0);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Finance</h2>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
          + Add Entry
        </button>
      </div>

      {/* ── Company Overview ── */}
      <div className="mb-8 space-y-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Company Overview</h3>

        {/* Row 1 — auto-calculated */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 mb-1">Stock Value</p>
            <p className="text-xl font-bold text-gray-900">{fmt(overview?.stock_value ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{overview?.cars_in_stock ?? 0} cars unsold</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-green-600">{fmt(overview?.total_income ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-1">excl. off-the-records</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 mb-1">Total Costs</p>
            <p className="text-xl font-bold text-red-500">{fmt(overview?.total_expenses ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-1">all time</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-400 mb-1">Net P&L</p>
            <p className={`text-xl font-bold ${netPL >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(netPL)}</p>
            <p className="text-xs text-gray-400 mt-1">revenue − costs</p>
          </div>
          {(overview?.off_the_records_balance ?? 0) > 0 && (
            <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-4">
              <p className="text-xs text-gray-400 mb-1">🔒 Off-the-Records Balance</p>
              <p className="text-xl font-bold text-gray-500">{fmt(overview?.off_the_records_balance ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">not in revenue</p>
            </div>
          )}
        </div>

        {/* Row 2 — Bank Balance */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Bank Balance</p>
              {overview?.bank_balance ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">{fmt(Number(overview.bank_balance.balance))}</p>
                  <p className="text-xs text-gray-400 mt-1">{overview.bank_balance.bank_name} · as of {fmtDate(overview.bank_balance.balance_date)}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">No balance recorded yet</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setShowBankHistory(!showBankHistory)}
                className="text-xs text-gray-500 border rounded px-2 py-1 hover:bg-gray-50">
                History ({overview?.bank_history.length ?? 0})
              </button>
              <button onClick={() => setShowBankModal(true)}
                className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">
                Update Balance
              </button>
            </div>
          </div>
          {showBankHistory && overview && overview.bank_history.length > 0 && (
            <div className="mt-3 border-t pt-3 space-y-1.5">
              {overview.bank_history.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{b.bank_name}</span>
                  <span className="font-medium">{fmt(Number(b.balance))}</span>
                  <span className="text-gray-400 text-xs">{fmtDate(b.balance_date)}</span>
                  <button onClick={() => deleteOverviewItem("bank", b.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row 3 — Capital Invested */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Capital Invested</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(overview?.capital_invested ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{overview?.investments.length ?? 0} investment{(overview?.investments.length ?? 0) !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setShowInvestments(!showInvestments)}
                className="text-xs text-gray-500 border rounded px-2 py-1 hover:bg-gray-50">
                View all
              </button>
              <button onClick={() => setShowInvestmentModal(true)}
                className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">
                + Add Investment
              </button>
            </div>
          </div>
          {showInvestments && overview && overview.investments.length > 0 && (
            <div className="mt-3 border-t pt-3 space-y-1.5">
              {overview.investments.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="text-gray-800 flex-1">{inv.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{inv.type}</span>
                  <span className="font-medium">{fmt(Number(inv.amount))}</span>
                  <span className="text-gray-400 text-xs">{fmtDate(inv.investment_date)}</span>
                  <button onClick={() => router.push(`/records?investment_id=${inv.id}`)} className="text-xs text-blue-600 hover:underline">Records →</button>
                  <button onClick={() => deleteOverviewItem("investment", inv.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {showModal && <AddEntryModal onClose={() => setShowModal(false)} onSaved={load} />}
      {showBankModal && <BankModal onClose={() => setShowBankModal(false)} onSaved={load} />}
      {showInvestmentModal && <InvestmentModal onClose={() => setShowInvestmentModal(false)} onSaved={load} />}
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
