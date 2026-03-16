"use client";

import { useEffect, useState } from "react";

// ─── Scraper Settings ──────────────────────────────────────────────────────────
type ScraperSettings = {
  SCRAPE_SEARCH_URL: string;
  SCRAPE_POSTCODE: string;
  SCRAPE_RADIUS: string;
  SCRAPE_MAX_PAGES: string;
  SCRAPE_MAX_PRICE: string;
  SCRAPE_MAX_MILEAGE: string;
  AUTOTRADER_EMAIL: string;
  AUTOTRADER_PASSWORD: string;
};

function ScraperSettingsSection() {
  const [form, setForm] = useState<ScraperSettings>({
    SCRAPE_SEARCH_URL: "",
    SCRAPE_POSTCODE: "",
    SCRAPE_RADIUS: "",
    SCRAPE_MAX_PAGES: "",
    SCRAPE_MAX_PRICE: "",
    SCRAPE_MAX_MILEAGE: "",
    AUTOTRADER_EMAIL: "",
    AUTOTRADER_PASSWORD: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/scraper-settings")
      .then((r) => r.json())
      .then((data) => { setForm(data); setLoading(false); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/scraper-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const f = (key: keyof ScraperSettings) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-1">AutoTrader Scraper Settings</h2>
      <p className="text-sm text-gray-500 mb-4">These are read by carhunt at the start of each scrape run.</p>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">AutoTrader Search URL</label>
            <textarea
              value={form.SCRAPE_SEARCH_URL}
              onChange={f("SCRAPE_SEARCH_URL")}
              placeholder="Paste your AutoTrader search URL here — if set, the fields below are ignored"
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">If set, this URL is used as-is (page number appended automatically). Leave blank to use the fields below.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Postcode</label>
              <input
                type="text"
                value={form.SCRAPE_POSTCODE}
                onChange={f("SCRAPE_POSTCODE")}
                placeholder="e.g. CB19PB"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Radius (miles)</label>
              <input
                type="number"
                min="1"
                value={form.SCRAPE_RADIUS}
                onChange={f("SCRAPE_RADIUS")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Max Price (£)</label>
              <input
                type="number"
                min="0"
                value={form.SCRAPE_MAX_PRICE}
                onChange={f("SCRAPE_MAX_PRICE")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Max Mileage</label>
              <input
                type="number"
                min="0"
                value={form.SCRAPE_MAX_MILEAGE}
                onChange={f("SCRAPE_MAX_MILEAGE")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Max Pages per Run</label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.SCRAPE_MAX_PAGES}
                onChange={f("SCRAPE_MAX_PAGES")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">AutoTrader Login (for phone numbers)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  value={form.AUTOTRADER_EMAIL}
                  onChange={f("AUTOTRADER_EMAIL")}
                  placeholder="your@email.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Password</label>
                <input
                  type="password"
                  value={form.AUTOTRADER_PASSWORD}
                  onChange={f("AUTOTRADER_PASSWORD")}
                  placeholder="••••••••"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          </div>
        </form>
      )}
    </div>
  );
}

type User = {
  id: number;
  username: string;
  google_email: string | null;
  created_by: string | null;
  created_at: string;
};

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username || undefined,
        google_email: googleEmail || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-1">Add User</h3>
        <p className="text-sm text-gray-500 mb-4">
          Add a Google email to allow someone to sign in via Google. Username defaults to the email if left blank.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Google Email *</label>
            <input
              type="email"
              required
              value={googleEmail}
              onChange={(e) => setGoogleEmail(e.target.value)}
              placeholder="their@gmail.com"
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Username (optional)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Defaults to email"
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Adding…" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteUser(id: number, username: string) {
    if (!confirm(`Remove user "${username}"? They will no longer be able to sign in.`)) return;
    await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Users who can access this portal</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No users yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Google Email</th>
                <th className="px-4 py-3 text-left">Added by</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500">{u.google_email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{u.created_by ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteUser(u.id, u.username)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">How login works</p>
        <ul className="space-y-1 text-blue-700 text-xs list-disc list-inside">
          <li>Google login: user must have their Google email added here</li>
          <li>Username/password login: set via <code className="bg-blue-100 px-1 rounded">ADMIN_PASSWORD</code> environment variable</li>
        </ul>
      </div>

      {showModal && <AddUserModal onClose={() => setShowModal(false)} onSaved={load} />}

      <ScraperSettingsSection />
    </div>
  );
}
