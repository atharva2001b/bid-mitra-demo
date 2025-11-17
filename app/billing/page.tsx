"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";

/**
 * Drop this file in a Next.js App Router project at: /app/billing/page.tsx
 *
 * Styling: Tailwind CSS (light theme). If Tailwind isn't set up, you can replace
 * the classNames with your own CSS. The code is otherwise framework‑agnostic React.
 *
 * Data: Replace the mock fetch in useEffect with a real API call (e.g. /api/billing).
 */

// -----------------------------
// Types
// -----------------------------
interface UsageSummary {
  totalPages: number;
  totalSearches: number;
  totalTokens: number; // prompt + completion tokens
  balanceInINR: number; // ₹
  quota?: {
    pages?: number;
    searches?: number;
    tokens?: number;
  };
}

interface UsageItem {
  id: string;
  date: string; // ISO date string
  description: string;
  pages: number;
  searches: number;
  tokens: number;
  amountINR: number; // positive = charge, negative = credit/top‑up
}

// -----------------------------
// Helpers
// -----------------------------
const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const numberFmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

function percentOf(part: number, whole?: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

// Simple sparkline without external libraries
function Sparkline({ points }: { points: number[] }) {
  const width = 120;
  const height = 36;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const stepX = width / (points.length - 1 || 1);
  const d = points
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-28 h-9 overflow-visible">
      <path d={d} className="stroke-[#3b82f6] fill-none" strokeWidth={2} />
      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopOpacity="0.25" stopColor="#93c5fd" />
        <stop offset="100%" stopOpacity="0" stopColor="#93c5fd" />
      </linearGradient>
      <path d={`${d} L ${width},${height} L 0,${height} Z`} fill="url(#sparkFill)" />
    </svg>
  );
}

// Progress bar
function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-200">
      <div
        className="h-2 rounded-full bg-blue-500 transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// Stat Card
function StatCard({
  label,
  value,
  sub,
  progress,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  spark?: number[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-slate-500 text-sm">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3">
          <Progress value={progress} />
          <div className="mt-1 text-[11px] text-slate-500">{progress}% of quota</div>
        </div>
      )}
      {spark && (
        <div className="mt-3"><Sparkline points={spark} /></div>
      )}
    </div>
  );
}

// Row actions button
function Button({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors";
  const cls =
    variant === "primary"
      ? `${base} bg-blue-600 text-white hover:bg-blue-700`
      : `${base} bg-transparent text-slate-700 hover:bg-slate-100 border border-slate-200`;
  return (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

// -----------------------------
// Page Component
// -----------------------------
export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [items, setItems] = useState<UsageItem[]>([]);

  useEffect(() => {
    // TODO: Replace with real fetch("/api/billing")
    const timer = setTimeout(() => {
      const mockSummary: UsageSummary = {
        totalPages: 18450,
        totalSearches: 3210,
        totalTokens: 42_300_000,
        balanceInINR: 12850,
        quota: { pages: 25000, searches: 5000, tokens: 60_000_000 },
      };
      const mockItems: UsageItem[] = [
        { id: "1", date: "2025-11-03", description: "OCR + RAG (PDF batch)", pages: 1200, searches: 86, tokens: 1_200_000, amountINR: 4200 },
        { id: "2", date: "2025-11-02", description: "Graph‑RAG queries", pages: 140, searches: 210, tokens: 3_100_000, amountINR: 1800 },
        { id: "3", date: "2025-11-01", description: "Top‑up (Wallet)", pages: 0, searches: 0, tokens: 0, amountINR: -5000 },
        { id: "4", date: "2025-10-31", description: "OCR (scanned bids)", pages: 2500, searches: 45, tokens: 7_600_000, amountINR: 8200 },
      ];
      setSummary(mockSummary);
      setItems(mockItems);
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const sparkPages = useMemo(() => [420, 680, 520, 1280, 760, 910, 1500, 980], []);
  const sparkSearch = useMemo(() => [30, 22, 28, 35, 31, 29, 38, 42], []);
  const sparkTokens = useMemo(() => [2.1, 3.2, 2.7, 4.8, 3.9, 5.1, 3.6, 4.2].map(v => v * 1_000_000), []);

  const quotas = summary?.quota ?? {};

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Billing & Usage</h1>
            <p className="mt-1 text-slate-500">Demo billing page for BidMitra AI • Light theme • Real‑time usage & wallet balance in INR</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => alert("Exporting invoice PDF...")}>Export Invoice</Button>
            <Button onClick={() => alert("Add funds flow")}>Add Funds</Button>
          </div>
        </header>

        {/* Summary Cards */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Processed Pages"
            value={summary ? numberFmt(summary.totalPages) : "—"}
            sub={quotas.pages ? `${numberFmt(summary?.totalPages ?? 0)} / ${numberFmt(quotas.pages)} pages` : undefined}
            progress={percentOf(summary?.totalPages ?? 0, quotas.pages)}
            spark={sparkPages}
          />
          <StatCard
            label="Total Searches"
            value={summary ? numberFmt(summary.totalSearches) : "—"}
            sub={quotas.searches ? `${numberFmt(summary?.totalSearches ?? 0)} / ${numberFmt(quotas.searches)} searches` : undefined}
            progress={percentOf(summary?.totalSearches ?? 0, quotas.searches)}
            spark={sparkSearch}
          />
          <StatCard
            label="Total Tokens"
            value={summary ? numberFmt(summary.totalTokens) : "—"}
            sub={quotas.tokens ? `${numberFmt(summary?.totalTokens ?? 0)} / ${numberFmt(quotas.tokens)} tokens` : undefined}
            progress={percentOf(summary?.totalTokens ?? 0, quotas.tokens)}
            spark={sparkTokens}
          />
          <StatCard
            label="Wallet Balance"
            value={summary ? currency(summary.balanceInINR) : "—"}
            sub="Auto‑recharge at ₹1,000 (configurable)"
          />
        </section>

        {/* Wallet + Settings */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <div className="text-xs text-slate-500">Last 30 days</div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Pages</th>
                    <th className="py-2 pr-4">Searches</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-0 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">Loading…</td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">No activity</td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="py-3 pr-4 text-slate-700">{new Date(it.date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</td>
                        <td className="py-3 pr-4 text-slate-700">{it.description}</td>
                        <td className="py-3 pr-4 text-slate-700">{it.pages ? numberFmt(it.pages) : "—"}</td>
                        <td className="py-3 pr-4 text-slate-700">{it.searches ? numberFmt(it.searches) : "—"}</td>
                        <td className="py-3 pr-4 text-slate-700">{it.tokens ? numberFmt(it.tokens) : "—"}</td>
                        <td className={`py-3 pr-0 text-right font-medium ${it.amountINR < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {it.amountINR < 0 ? `+ ${currency(Math.abs(it.amountINR))}` : `− ${currency(it.amountINR)}`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Wallet & Limits</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="mb-1 text-slate-600">Auto‑Recharge Threshold</div>
                <div className="flex items-center gap-2">
                  <input defaultValue={1000} type="number" className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button variant="ghost" onClick={() => alert("Saved")}>Save</Button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-slate-600">Monthly Page Quota</div>
                <div className="flex items-center gap-2">
                  <input defaultValue={summary?.quota?.pages ?? 25000} type="number" className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button variant="ghost" onClick={() => alert("Saved")}>Save</Button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-slate-600">Monthly Search Quota</div>
                <div className="flex items-center gap-2">
                  <input defaultValue={summary?.quota?.searches ?? 5000} type="number" className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button variant="ghost" onClick={() => alert("Saved")}>Save</Button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-slate-600">Monthly Token Quota</div>
                <div className="flex items-center gap-2">
                  <input defaultValue={summary?.quota?.tokens ?? 60_000_000} type="number" className="w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button variant="ghost" onClick={() => alert("Saved")}>Save</Button>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
              Pricing and tax details are configurable. Displayed values are indicative for development.
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} BidMitra AI · Billing module UI · Light theme
        </footer>
      </div>
    </AppLayout>
  );
}
