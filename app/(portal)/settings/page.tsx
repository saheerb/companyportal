"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Scraper Settings ──────────────────────────────────────────────────────────
type ScraperSettings = {
  SCRAPE_SEARCH_URL: string;
  AUTOTRADER_EMAIL: string;
  AUTOTRADER_PASSWORD: string;
};

function ScraperSettingsSection() {
  const [form, setForm] = useState<ScraperSettings>({
    SCRAPE_SEARCH_URL: "",
    AUTOTRADER_EMAIL: "",
    AUTOTRADER_PASSWORD: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  useEffect(() => {
    fetch("/api/scraper-settings")
      .then((r) => r.json())
      .then((data) => { setForm(data); setLoading(false); });
  }, []);

  async function handleRunNow() {
    setRunning(true);
    setRunMsg("");
    const res = await fetch("/api/scraper-run", { method: "POST" });
    const data = await res.json();
    setRunning(false);
    setRunMsg(res.ok ? "Scrape started!" : (data.error || "Failed to start scrape"));
    setTimeout(() => setRunMsg(""), 4000);
  }

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

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
            <button
              type="button"
              onClick={handleRunNow}
              disabled={running}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {running ? "Starting…" : "Run Now"}
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            {runMsg && <span className={`text-sm font-medium ${runMsg.includes("started") ? "text-green-600" : "text-red-600"}`}>{runMsg}</span>}
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
      <SceneScenesSection />
      <DealerBrandingSection />
      <AiUsageSection />
    </div>
  );
}

// ─── AI Usage ─────────────────────────────────────────────────────────────────
type AiUsageData = {
  total_cost_usd: number;
  by_operation: { operation: string; count: number; input_tokens: number; output_tokens: number; cost_usd: number }[];
  recent: { id: number; created_at: string; operation: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number }[];
};

function AiUsageSection() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ai-usage");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const opLabels: Record<string, string> = {
    showroom: "Showroom",
    car_blurbs: "Car Blurbs",
    dealer_blurbs: "Dealer Blurbs",
    listing_description: "Listing Description",
    video: "Video (Veo)",
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">AI Usage & Costs</h3>
          <p className="text-sm text-gray-500 mt-0.5">Token usage and estimated costs for all AI operations</p>
        </div>
        {data && (
          <span className="text-sm font-semibold bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg">
            ${data.total_cost_usd.toFixed(4)} total
          </span>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      ) : !data || (data.by_operation.length === 0) ? (
        <p className="text-sm text-gray-400 bg-white border rounded-lg p-4">No AI usage recorded yet. Generate a showroom photo, blurbs, or description to see costs here.</p>
      ) : (
        <div className="space-y-4">
          {/* By operation */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Operation</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Tokens In</th>
                  <th className="px-4 py-3 text-right">Tokens Out</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.by_operation.map(row => (
                  <tr key={row.operation} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{opLabels[row.operation] ?? row.operation}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{row.count}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{row.input_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{row.output_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-800">${row.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">${data.total_cost_usd.toFixed(4)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Recent calls */}
          {data.recent.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent Calls</p>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-b text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Operation</th>
                      <th className="px-4 py-2 text-left">Model</th>
                      <th className="px-4 py-2 text-right">In</th>
                      <th className="px-4 py-2 text-right">Out</th>
                      <th className="px-4 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recent.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-400">
                          {new Date(row.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-2 font-medium">{opLabels[row.operation] ?? row.operation}</td>
                        <td className="px-4 py-2 text-gray-400 font-mono">{row.model.replace("gemini-", "").replace("-generate-001", "")}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{row.input_tokens.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{row.output_tokens.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-700">${row.cost_usd.toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scene Settings ────────────────────────────────────────────────────────────
type Scene = {
  id: number;
  scene_key: string;
  label: string;
  preview_emoji: string;
  prompt_template: string;
  background_path: string | null;
  is_active: boolean;
  sort_order: number;
};

function SceneScenesSection() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, Partial<Scene>>>({});
  const [bgUploading, setBgUploading] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // New scene form
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ scene_key: "", label: "", preview_emoji: "🚗", prompt_template: "" });
  const [addingSave, setAddingSave] = useState(false);

  useEffect(() => {
    fetch("/api/showroom-scenes")
      .then((r) => r.json())
      .then((data: Scene[]) => {
        setScenes(data);
        const init: Record<number, Partial<Scene>> = {};
        data.forEach((s) => { init[s.id] = { label: s.label, preview_emoji: s.preview_emoji, prompt_template: s.prompt_template }; });
        setForms(init);
        setLoading(false);
      });
  }, []);

  function updateForm(id: number, patch: Partial<Scene>) {
    setForms((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  }

  async function saveScene(scene: Scene) {
    setSaving(scene.id);
    await fetch(`/api/showroom-scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forms[scene.id]),
    });
    setSaving(null);
    setScenes((prev) => prev.map((s) => s.id === scene.id ? { ...s, ...forms[scene.id] } : s));
  }

  async function deleteScene(id: number) {
    if (!confirm("Deactivate this scene?")) return;
    await fetch(`/api/showroom-scenes/${id}`, { method: "DELETE" });
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }

  async function uploadBg(sceneId: number, file: File) {
    setBgUploading(sceneId);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json() as { path?: string };
    if (d.path) {
      await fetch(`/api/showroom-scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background_path: d.path }),
      });
      setScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, background_path: d.path ?? null } : s));
    }
    setBgUploading(null);
  }

  async function addScene(e: React.FormEvent) {
    e.preventDefault();
    setAddingSave(true);
    const res = await fetch("/api/showroom-scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    const added = await res.json() as Scene;
    setScenes((prev) => [...prev, added]);
    setForms((f) => ({ ...f, [added.id]: { label: added.label, preview_emoji: added.preview_emoji, prompt_template: added.prompt_template } }));
    setNewForm({ scene_key: "", label: "", preview_emoji: "🚗", prompt_template: "" });
    setShowAdd(false);
    setAddingSave(false);
  }

  return (
    <>
    {lightboxSrc && (
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
        onClick={() => setLightboxSrc(null)}
      >
        <img src={lightboxSrc} alt="Background" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
      </div>
    )}
    <div className="mt-10">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-gray-900">Scene Settings</h2>
        <button onClick={() => setShowAdd(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
          + Add Scene
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Manage AI showroom scene prompts and optional background images.</p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <div key={scene.id} className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{forms[scene.id]?.preview_emoji ?? scene.preview_emoji}</span>
                <input
                  value={forms[scene.id]?.preview_emoji ?? scene.preview_emoji}
                  onChange={(e) => updateForm(scene.id, { preview_emoji: e.target.value })}
                  className="w-16 border rounded px-2 py-1 text-sm"
                  placeholder="emoji"
                />
                <input
                  value={forms[scene.id]?.label ?? scene.label}
                  onChange={(e) => updateForm(scene.id, { label: e.target.value })}
                  className="flex-1 border rounded px-2 py-1 text-sm font-medium"
                  placeholder="Label"
                />
                <span className="text-xs text-gray-400 font-mono">{scene.scene_key}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prompt</label>
                <textarea
                  value={forms[scene.id]?.prompt_template ?? scene.prompt_template}
                  onChange={(e) => updateForm(scene.id, { prompt_template: e.target.value })}
                  rows={3}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Background Image (optional)</label>
                  {scene.background_path && (
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={scene.background_path}
                        alt="Background"
                        className="h-14 w-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxSrc(scene.background_path)}
                        title="Click to enlarge"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/showroom-scenes/${scene.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ background_path: null }),
                          });
                          setScenes((prev) => prev.map((s) => s.id === scene.id ? { ...s, background_path: null } : s));
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { if (e.target.files?.[0]) uploadBg(scene.id, e.target.files[0]); }}
                    className="text-xs"
                    disabled={bgUploading === scene.id}
                  />
                  {bgUploading === scene.id && <span className="text-xs text-blue-500 ml-2">Uploading…</span>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => saveScene(scene)}
                    disabled={saving === scene.id}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving === scene.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => deleteScene(scene.id)}
                    className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <form onSubmit={addScene} className="mt-4 bg-gray-50 rounded-lg border p-4 space-y-3">
          <p className="text-sm font-semibold">New Scene</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scene Key (unique, no spaces)</label>
              <input required value={newForm.scene_key} onChange={(e) => setNewForm({ ...newForm, scene_key: e.target.value })}
                placeholder="e.g. beach" className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input required value={newForm.label} onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
                placeholder="Beach" className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Emoji</label>
              <input value={newForm.preview_emoji} onChange={(e) => setNewForm({ ...newForm, preview_emoji: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Prompt *</label>
              <textarea required value={newForm.prompt_template} onChange={(e) => setNewForm({ ...newForm, prompt_template: e.target.value })}
                rows={3} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={addingSave} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {addingSave ? "Adding…" : "Add Scene"}
            </button>
          </div>
        </form>
      )}
    </div>
    </>
  );
}

// ─── Dealer Branding ───────────────────────────────────────────────────────────
type DealerSettings = {
  id: number;
  dealer_name: string;
  dealer_prompt: string | null;
  dealer_blurbs: string[];
  badge_path: string | null;
  car_slots: number;
  dealer_slots: number;
};

function DealerBrandingSection() {
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingBlurbs, setGeneratingBlurbs] = useState(false);
  const [badgeUploading, setBadgeUploading] = useState(false);
  const [form, setForm] = useState({
    dealer_name: "", dealer_prompt: "", car_slots: 5, dealer_slots: 3,
  });
  const [blurbsText, setBlurbsText] = useState("");

  useEffect(() => {
    fetch("/api/dealer-settings")
      .then((r) => r.json())
      .then((d: DealerSettings | null) => {
        if (d) {
          setSettings(d);
          setForm({ dealer_name: d.dealer_name, dealer_prompt: d.dealer_prompt ?? "", car_slots: d.car_slots, dealer_slots: d.dealer_slots });
          setBlurbsText((d.dealer_blurbs ?? []).join("\n"));
        }
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const blurbs = blurbsText.split("\n").map((l) => l.trim()).filter(Boolean);
    await fetch("/api/dealer-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dealer_blurbs: blurbs }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function generateBlurbs() {
    setGeneratingBlurbs(true);
    const res = await fetch("/api/dealer-settings/generate-blurbs", { method: "POST" });
    const d = await res.json();
    console.log("[generateBlurbs] response:", d);
    setGeneratingBlurbs(false);
    if (!res.ok) { alert(`Error: ${d.error ?? "Unknown error"}`); return; }
    if (d.dealer_blurbs?.length) setBlurbsText(d.dealer_blurbs.join("\n"));
  }

  async function uploadBadge(file: File) {
    setBadgeUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json() as { path?: string };
    if (d.path) {
      await fetch("/api/dealer-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge_path: d.path }),
      });
      setSettings((prev) => prev ? { ...prev, badge_path: d.path ?? null } : prev);
    }
    setBadgeUploading(false);
  }

  if (loading) return <div className="mt-10 animate-pulse h-24 bg-gray-100 rounded-lg" />;

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Dealer Branding</h2>
      <p className="text-sm text-gray-500 mb-4">Configure dealer name, taglines and badge for photo banners.</p>

      <form onSubmit={handleSave} className="bg-white rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Dealer Name</label>
            <input value={form.dealer_name} onChange={(e) => setForm({ ...form, dealer_name: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Car Slots on Banner</label>
            <input type="number" min={1} max={10} value={form.car_slots} onChange={(e) => setForm({ ...form, car_slots: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Dealer Slots on Banner</label>
            <input type="number" min={1} max={10} value={form.dealer_slots} onChange={(e) => setForm({ ...form, dealer_slots: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Dealer Info (used by AI to generate blurbs)</label>
          <textarea value={form.dealer_prompt} onChange={(e) => setForm({ ...form, dealer_prompt: e.target.value })}
            rows={2} placeholder="e.g. FCA approved, AA approved, 6 month warranty, family-run business since 2010..."
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Dealer Blurbs</label>
            <button type="button" onClick={generateBlurbs} disabled={generatingBlurbs}
              className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-50">
              {generatingBlurbs ? "Generating…" : "Generate with AI ✨"}
            </button>
          </div>
          <textarea value={blurbsText} onChange={(e) => setBlurbsText(e.target.value)}
            rows={4} placeholder="One blurb per line"
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Badge Image</label>
          {settings?.badge_path && (
            <div className="mb-2">
              <img src={settings.badge_path} alt="Badge" className="h-16 object-contain border rounded p-1" />
            </div>
          )}
          <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) uploadBadge(e.target.files[0]); }}
            disabled={badgeUploading} className="text-sm" />
          {badgeUploading && <span className="text-xs text-blue-500 ml-2">Uploading…</span>}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
