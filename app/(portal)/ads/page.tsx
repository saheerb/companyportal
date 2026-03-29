"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Listing = {
  id: number;
  inventory_id: number;
  title: string;
  price: number;
  status: string;
  created_at: string;
  car_name: string | null;
  reg: string;
  publications: { platform: string; status: string }[] | null;
};

const STATUS_TABS = ["all", "draft", "published", "paused"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
};

export default function AdsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  async function load(status?: string) {
    setLoading(true);
    const url = status && status !== "all" ? `/api/listings?status=${status}` : "/api/listings";
    const res = await fetch(url);
    const data = await res.json() as Listing[];
    setListings(data);
    setLoading(false);
  }

  useEffect(() => {
    load(activeTab === "all" ? undefined : activeTab);
  }, [activeTab]);

  function fmt(n: number) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
  }

  const livePlatforms = (pubs: Listing["publications"]) =>
    (pubs ?? []).filter((p) => p.status === "live").map((p) =>
      p.platform === "autotrader" ? "AutoTrader" : "Facebook"
    );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ads</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your car listings and ads</p>
        </div>
        <Link
          href="/ads/new"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Ad
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No ads yet.</p>
          <Link href="/ads/new" className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Create your first ad
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {listings.map((listing) => {
            const live = livePlatforms(listing.publications);
            return (
              <Link
                key={listing.id}
                href={`/ads/${listing.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-gray-500">{listing.reg}</span>
                    {listing.car_name && <span className="text-xs text-gray-400">— {listing.car_name}</span>}
                  </div>
                  <p className="font-medium text-sm truncate">{listing.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[listing.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {listing.status}
                    </span>
                    {live.length > 0 && (
                      <span className="text-xs text-gray-400">Live on: {live.join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-semibold text-gray-900">{fmt(Number(listing.price))}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(listing.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
