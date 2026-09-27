"use client";

import { useSyncExternalStore } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { collapseCategories, type CategoryTotal } from "@/lib/analytics/month";
import { formatKRW, formatKRWShort, toKRW } from "@/lib/domain/money";

const COLORS = ["#557C70", "#758A72", "#8A7D67", "#657C8A", "#8B7070", "#77758B", "#6E897F", "#8A8768"];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? true, () => true);
}

export function CategoryChart({ items }: { items: CategoryTotal[] }) {
  const data = collapseCategories(items); const total = data.reduce((sum, item) => sum + item.amount, 0);
  const reduceMotion = useReducedMotion();
  return <div className="space-y-4">
    <div className="h-72" aria-label="카테고리별 지출 차트"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}><XAxis type="number" tickFormatter={(value: number) => formatKRWShort(toKRW(value))} /><YAxis type="category" dataKey="category" width={86} /><Tooltip formatter={(value) => formatKRW(toKRW(Number(value ?? 0)))} /><Bar dataKey="amount" isAnimationActive={!reduceMotion} animationDuration={150}>{data.map((item, index) => <Cell key={item.category} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
    <ul className="divide-y divide-line">{data.map((item) => <li key={item.category} className="flex items-center gap-3 py-3 text-sm"><span className="flex-1 text-body">{item.category}</span><span className="tabular-nums text-muted">{total === 0 ? 0 : Math.round(item.amount / total * 100)}%</span><span className="w-28 text-right tabular-nums text-ink">{formatKRW(item.amount)}</span></li>)}</ul>
  </div>;
}
