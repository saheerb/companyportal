"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";

const STATUSES = ["Bought", "Being Prepped", "Listed for Sale", "Sold"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}


export default function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pipeline = data.inventoryPipeline as { status: string; count: string }[];
  const pipelineMap = Object.fromEntries(pipeline.map((p) => [p.status, parseInt(p.count)]));
  const monthlyPL = data.monthlyPL as { month: string; income: string; expenses: string }[];

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your business</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Leads Today" value={data.leadsToday as number} color="blue" />
        <StatCard title="Pending Offers" value={data.pendingOffers as number} color="yellow" />
        <StatCard title="In Inventory" value={data.inventoryCount as number} color="gray" />
        <StatCard title="Month Income" value={fmt(data.monthIncome as number)} color="green" />
        <StatCard title="Month Expenses" value={fmt(data.monthExpenses as number)} color="red" />
        <StatCard
          title="Month Profit"
          value={fmt(data.monthProfit as number)}
          color={(data.monthProfit as number) >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Pipeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Inventory Pipeline</h3>
          <div className="space-y-3">
            {STATUSES.map((status) => {
              const count = pipelineMap[status] ?? 0;
              const maxCount = Math.max(...STATUSES.map((s) => pipelineMap[s] ?? 0), 1);
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly P&L */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly P&L (last 6 months)</h3>
          {monthlyPL.length === 0 ? (
            <p className="text-sm text-gray-400">No finance data yet.</p>
          ) : (
            <div className="space-y-2">
              {monthlyPL.map((row) => {
                const profit = parseFloat(row.income) - parseFloat(row.expenses);
                return (
                  <div key={row.month} className="flex items-center gap-3 text-sm">
                    <span className="w-20 text-gray-500 text-xs">{row.month}</span>
                    <span className="text-green-600 w-20">{fmt(parseFloat(row.income))}</span>
                    <span className="text-red-500 w-20">{fmt(parseFloat(row.expenses))}</span>
                    <span className={`font-medium ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmt(profit)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
