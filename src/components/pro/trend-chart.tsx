"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/analytics/compare";
import { formatKRW, formatKRWShort, formatSignedKRW, toKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";

const shortAmount = (value: number) => value < 0 ? `−${formatKRWShort(toKRW(Math.abs(value)))}` : formatKRWShort(toKRW(value));
const fullAmount = (value: number) => value < 0 ? formatSignedKRW(value) : formatKRW(toKRW(value));

export function TrendChart({ points }: { points: TrendPoint[] }) {
  return <div><div className="h-64 w-full" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}><CartesianGrid vertical={false} stroke="#E1E5E2" /><XAxis dataKey="month" tickFormatter={(value: string) => formatMonthLabel(value as TrendPoint["month"], "short")} /><YAxis tickFormatter={shortAmount} /><Tooltip formatter={(value) => fullAmount(Number(value))} labelFormatter={(label) => formatMonthLabel(String(label) as TrendPoint["month"])} /><Bar dataKey="net" fill="#5F8278" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><ul aria-label="월별 추이 데이터" className="sr-only">{points.map((point) => <li key={point.month}>{formatMonthLabel(point.month, "short")}{fullAmount(point.net)}</li>)}</ul></div>;
}
