import { createHash } from "node:crypto";

import { err, ok, type Result } from "@/lib/domain/result";
import { z } from "zod";

import { parseAmountCell, parseDateCell } from "./parse";
import { isSummaryRow, normalizeHeader, tableAtHeader, type TableGuess } from "./table";

const columnIndex = z.number().int().min(0).max(99);

export const columnMappingSchema = z.object({
  headerRowIndex: z.number().int().min(0).max(29),
  columns: z.object({
    date: columnIndex,
    merchant: columnIndex,
    amount: columnIndex,
    approvalNo: columnIndex.optional(),
    installment: columnIndex.optional(),
    cancelFlag: columnIndex.optional(),
    foreignAmount: columnIndex.optional(),
    foreignCurrency: columnIndex.optional(),
    cardNumber: columnIndex.optional(),
  }).strict(),
}).strict();

export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type MappingColumns = ColumnMapping["columns"];

export function headerSignature(headers: string[]): string {
  const normalized = headers.map(normalizeHeader);
  while (normalized.at(-1) === "") normalized.pop();
  return createHash("sha256").update(normalized.join("\u001f")).digest("hex");
}

export function validateMapping(mapping: ColumnMapping, table: TableGuess): Result<ColumnMapping, "MAPPING_INVALID"> {
  const parsed = columnMappingSchema.safeParse(mapping);
  if (!parsed.success) return err("MAPPING_INVALID");
  const selected = tableAtHeader(table, mapping.headerRowIndex);
  if (!selected) return err("MAPPING_INVALID");
  const indices = Object.values(mapping.columns).filter((value): value is number => value !== undefined);
  if (indices.some((index) => index >= selected.headers.length)) return err("MAPPING_INVALID");
  const { date, merchant, amount } = mapping.columns;
  if (new Set([date, merchant, amount]).size !== 3) return err("MAPPING_INVALID");
  const samples = selected.dataRows.filter((row) =>
    !isSummaryRow(row) && [row[date], row[merchant], row[amount]].some((cell) => cell !== ""),
  ).slice(0, 20);
  if (samples.length === 0) return err("MAPPING_INVALID");
  const dateRate = samples.filter((row) => parseDateCell(row[date] ?? "") !== null).length / samples.length;
  const amountRate = samples.filter((row) => parseAmountCell(row[amount] ?? "") !== null).length / samples.length;
  return dateRate >= 0.95 && amountRate >= 0.95 ? ok(mapping) : err("MAPPING_INVALID");
}
