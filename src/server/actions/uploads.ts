import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { AppError, ERROR_CODES, type ErrorCode } from "@/lib/domain/errors";
import { kstToday } from "@/lib/domain/month";
import type { IsoDate } from "@/lib/domain/types";
import type { AnalyzeResponse, ConfirmResponse, CreateUploadResponse, RecategorizeResponse } from "@/lib/domain/upload";
import { checkUploadFile, UPLOAD_LIMITS } from "@/lib/domain/upload";
import { decodeFile } from "@/lib/ingest/decode";
import { identityKey } from "@/lib/ingest/identity";
import { columnMappingSchema, headerSignature, validateMapping, type ColumnMapping } from "@/lib/ingest/mapping";
import { maskSamples } from "@/lib/ingest/mask";
import { parseRows } from "@/lib/ingest/parse";
import { sniffFile } from "@/lib/ingest/sniff";
import { detectTable, isSummaryRow, tableAtHeader, type TableGuess } from "@/lib/ingest/table";
import { adminStorage, storagePathFor } from "@/server/admin";
import { categorizeTransactions } from "@/server/actions/categorize";
import { assertDailyLimit, recordAiUsage } from "@/server/limits";
import { logger } from "@/server/logger";
import { proposeMapping } from "@/services/claude/mapper";
import { createServerSupabase } from "@/services/supabase/server";
import type { Database, Json } from "@/types/database";

export const createUploadBody = z.object({ filename: z.string().min(1).max(255), size: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
export const confirmUploadBody = z.object({ mapping: columnMappingSchema, card: z.union([z.object({ id: z.uuid() }).strict(), z.object({ name: z.string().trim().min(1).max(30) }).strict()]) }).strict();

type UploadRow = Database["public"]["Tables"]["uploads"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
const UUID = z.uuid();
const CHUNK = 500;

function fail(code: ErrorCode): never { throw new AppError(code); }
function db(error: unknown): void { if (error) fail("INTERNAL"); }
function knownCode(value: string | null): ErrorCode { return ERROR_CODES.find((code) => code === value) ?? "INTERNAL"; }
function chunks<T>(rows: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

async function getUpload(userId: string, uploadId: string): Promise<UploadRow> {
  if (!UUID.safeParse(uploadId).success) fail("NOT_FOUND");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("uploads").select("*").eq("user_id", userId).eq("id", uploadId).maybeSingle();
  db(error); if (!data) fail("NOT_FOUND"); return data;
}

async function markFailed(userId: string, uploadId: string, code: ErrorCode): Promise<never> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("uploads").update({ status: "failed", error_code: code }).eq("user_id", userId).eq("id", uploadId);
  db(error); return fail(code);
}

async function loadTable(userId: string, upload: UploadRow): Promise<TableGuess> {
  if (!upload.storage_path.startsWith(`${userId}/`)) fail("INTERNAL");
  const bytes = await adminStorage.read(upload.storage_path);
  if (!bytes) fail("INVALID_STATE");
  if (bytes.length > UPLOAD_LIMITS.maxBytes) return markFailed(userId, upload.id, "FILE_TOO_LARGE");
  if (createHash("sha256").update(bytes).digest("hex") !== upload.sha256) return markFailed(userId, upload.id, "CORRUPT_FILE");
  const sniffed = sniffFile(bytes, upload.filename);
  if (!sniffed.ok) return markFailed(userId, upload.id, sniffed.error);
  const decoded = decodeFile(bytes, sniffed.value);
  if (!decoded.ok) return markFailed(userId, upload.id, decoded.error);
  const table = detectTable(decoded.value);
  if (!table.ok) return markFailed(userId, upload.id, table.error);
  return table.value;
}

export async function createUpload(userId: string, input: z.infer<typeof createUploadBody>): Promise<CreateUploadResponse> {
  const fileError = checkUploadFile({ name: input.filename, size: input.size }); if (fileError) fail(fileError);
  const supabase = await createServerSupabase();
  const { data: existing, error: existingError } = await supabase.from("uploads").select("id,status").eq("user_id", userId).eq("sha256", input.sha256).neq("status", "failed").maybeSingle();
  db(existingError); if (existing?.status === "done") fail("DUPLICATE_FILE");
  if (existing) {
    await adminStorage.removePrefix(`${userId}/${existing.id}/`);
    const { error } = await supabase.from("uploads").delete().eq("user_id", userId).eq("id", existing.id); db(error);
  }
  await assertDailyLimit(userId, "uploads");
  const uploadId = randomUUID(); const storagePath = storagePathFor(userId, uploadId);
  const { error } = await supabase.from("uploads").insert({ id: uploadId, user_id: userId, storage_path: storagePath, filename: input.filename, sha256: input.sha256, byte_size: input.size, status: "uploaded" });
  if (error?.code === "23505") fail("DUPLICATE_FILE"); db(error);
  return { uploadId, uploadUrl: await adminStorage.createUploadUrl(storagePath) };
}

function mappingFrom(value: Json | null): ColumnMapping | null {
  const parsed = columnMappingSchema.safeParse(value); return parsed.success ? parsed.data : null;
}

export async function analyzeUpload(userId: string, uploadId: string): Promise<AnalyzeResponse> {
  const upload = await getUpload(userId, uploadId);
  if (upload.status === "done") fail("INVALID_STATE"); if (upload.status === "failed") fail(knownCode(upload.error_code));
  const table = await loadTable(userId, upload); const signature = headerSignature(table.headers); const supabase = await createServerSupabase();
  let mapping: ColumnMapping | null = null; let source: "cache" | "stored" | "ai" | null = null;
  const { data: cached, error: cacheError } = await supabase.from("header_mappings").select("mapping").eq("user_id", userId).eq("signature", signature).maybeSingle(); db(cacheError);
  const cachedMapping = mappingFrom(cached?.mapping ?? null);
  if (cachedMapping) { const candidate = { ...cachedMapping, headerRowIndex: table.headerRowIndex }; if (validateMapping(candidate, table).ok) { mapping = candidate; source = "cache"; } }
  if (!mapping && upload.status === "awaiting_confirm") { const stored = mappingFrom(upload.mapping); if (stored && validateMapping(stored, table).ok) { mapping = stored; source = "stored"; } }
  if (!mapping) {
    try {
      await assertDailyLimit(userId, "mapping");
      const masked = maskSamples(table.headers, table.dataRows.filter((row) => !isSummaryRow(row)).slice(0, 5));
      const proposed = await proposeMapping(masked); const candidate = { headerRowIndex: table.headerRowIndex, columns: proposed.mapping };
      if (validateMapping(candidate, table).ok) { mapping = candidate; source = "ai"; }
      await recordAiUsage(userId, "mapping", proposed.usage);
    } catch (error) { logger.warn("upload.mapping_unavailable", { code: error instanceof AppError ? error.code : "UNKNOWN" }); }
  }
  const { error } = await supabase.from("uploads").update({ status: "awaiting_confirm", mapping: mapping as Json, header_signature: signature, error_code: null }).eq("user_id", userId).eq("id", uploadId); db(error);
  return { preview: { sheetName: table.sheetName, headerRowIndex: table.headerRowIndex, rows: table.sheetRows.slice(0, table.headerRowIndex + 6) }, mapping, autoConfirm: source === "cache" };
}

async function chooseCard(userId: string, card: z.infer<typeof confirmUploadBody>["card"]): Promise<string> {
  const supabase = await createServerSupabase();
  if ("id" in card) { const { data, error } = await supabase.from("cards").select("id").eq("user_id", userId).eq("id", card.id).maybeSingle(); db(error); if (!data) fail("VALIDATION_FAILED"); return data.id; }
  const { data, error } = await supabase.from("cards").upsert({ user_id: userId, name: card.name }, { onConflict: "user_id,name" }).select("id").single(); db(error); if (!data) fail("INTERNAL"); return data.id;
}

async function pendingCount(userId: string, uploadId: string): Promise<number> {
  const supabase = await createServerSupabase(); const { count, error } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("upload_id", uploadId).eq("category_source", "pending"); db(error); return count ?? 0;
}

function savedResult(upload: UploadRow, pending: number): ConfirmResponse {
  const raw = upload.counts && typeof upload.counts === "object" && !Array.isArray(upload.counts) ? upload.counts : {};
  return { inserted: Number(raw.inserted ?? 0), duplicates: Number(raw.duplicates ?? 0), pending, period: upload.period_from && upload.period_to ? { from: upload.period_from as IsoDate, to: upload.period_to as IsoDate } : null };
}

async function categorizePending(userId: string, uploadId: string): Promise<{ updated: number; pending: number; aiFailed: boolean; rateLimited: boolean }> {
  const supabase = await createServerSupabase();
  const { data: pendingRows, error } = await supabase.from("transactions").select("merchant_key").eq("user_id", userId).eq("upload_id", uploadId).eq("category_source", "pending"); db(error);
  if (!pendingRows?.length) return { updated: 0, pending: 0, aiFailed: false, rateLimited: false };
  const result = await categorizeTransactions(userId, pendingRows.map((row) => ({ merchantKey: row.merchant_key })));
  for (const usage of result.usage) await recordAiUsage(userId, "classify", usage);
  let updated = 0;
  const groups = new Map<string, { category: string; source: TransactionInsert["category_source"]; keys: string[] }>();
  for (const [key, value] of result.byKey) {
    if (value.source === "pending") continue;
    const groupKey = `${value.category}\0${value.source}`; const group = groups.get(groupKey) ?? { category: value.category, source: value.source, keys: [] }; group.keys.push(key); groups.set(groupKey, group);
  }
  for (const group of groups.values()) for (const part of chunks(group.keys, 100)) {
    const { data, error: updateError } = await supabase.from("transactions").update({ category: group.category, category_source: group.source }).eq("user_id", userId).eq("upload_id", uploadId).eq("category_source", "pending").in("merchant_key", part).select("id"); db(updateError); updated += data?.length ?? 0;
  }
  return { updated, pending: await pendingCount(userId, uploadId), aiFailed: result.aiFailed, rateLimited: result.rateLimited };
}

export async function confirmUpload(userId: string, uploadId: string, input: z.infer<typeof confirmUploadBody>): Promise<ConfirmResponse> {
  const upload = await getUpload(userId, uploadId); if (upload.status === "done") return savedResult(upload, await pendingCount(userId, uploadId)); if (upload.status !== "awaiting_confirm") fail("INVALID_STATE");
  const table = await loadTable(userId, upload); if (!validateMapping(input.mapping, table).ok) fail("MAPPING_INVALID");
  const parsed = parseRows(table, input.mapping, kstToday()); if (!parsed.rows.length) fail("NO_DATA");
  const cardId = await chooseCard(userId, input.card); const supabase = await createServerSupabase();
  const keyed = parsed.rows.map((row) => ({ row, key: identityKey({ userId, cardId, approvalNo: row.approvalNo, occurredOn: row.occurredOn, kind: row.kind, merchantKey: row.merchantKey, amountKrw: row.amountKrw, occurrence: row.occurrence }) }));
  const existing = new Map<string, { upload_id: string; category: string; category_source: TransactionInsert["category_source"] }>();
  for (const part of chunks(keyed.map(({ key }) => key), 100)) { const { data, error } = await supabase.from("transactions").select("identity_key,upload_id,category,category_source").eq("user_id", userId).in("identity_key", part); db(error); for (const row of data ?? []) existing.set(row.identity_key, row); }
  const records: TransactionInsert[] = keyed.map(({ row, key }) => { const old = existing.get(key); return { user_id: userId, card_id: cardId, upload_id: old?.upload_id ?? uploadId, occurred_on: row.occurredOn, merchant_raw: row.merchantRaw, merchant_key: row.merchantKey, amount_krw: row.amountKrw, kind: row.kind, status: row.status, installment_months: row.installmentMonths, foreign_amount: row.foreignAmount, foreign_currency: row.foreignCurrency, approval_no: row.approvalNo, category: old?.category ?? "기타", category_source: old?.category_source ?? "pending", identity_key: key }; });
  for (const part of chunks(records)) { const { error } = await supabase.from("transactions").upsert(part, { onConflict: "user_id,identity_key" }); db(error); }
  const categorized = await categorizePending(userId, uploadId); const inserted = records.filter((row) => row.upload_id === uploadId).length; const duplicates = records.length - inserted;
  const mappedTable = tableAtHeader(table, input.mapping.headerRowIndex); if (!mappedTable) fail("MAPPING_INVALID"); const signature = headerSignature(mappedTable.headers);
  const result: ConfirmResponse = { inserted, duplicates, pending: categorized.pending, period: parsed.period };
  const { error: mapError } = await supabase.from("header_mappings").upsert({ user_id: userId, signature, mapping: input.mapping as Json }, { onConflict: "user_id,signature" }); db(mapError);
  const counts = { inserted, duplicates, pending: categorized.pending, skipped: parsed.skipped.length };
  const { error: doneError } = await supabase.from("uploads").update({ status: "done", card_id: cardId, mapping: input.mapping as Json, header_signature: signature, period_from: parsed.period?.from ?? null, period_to: parsed.period?.to ?? null, counts }).eq("user_id", userId).eq("id", uploadId); db(doneError);
  return result;
}

export async function recategorizeUpload(userId: string, uploadId: string): Promise<RecategorizeResponse> {
  const upload = await getUpload(userId, uploadId); if (upload.status !== "done") fail("INVALID_STATE"); const result = await categorizePending(userId, uploadId);
  const raw = upload.counts && typeof upload.counts === "object" && !Array.isArray(upload.counts) ? upload.counts : {}; const supabase = await createServerSupabase();
  const { error } = await supabase.from("uploads").update({ counts: { ...raw, pending: result.pending } }).eq("user_id", userId).eq("id", uploadId); db(error); if (result.aiFailed) fail("AI_UNAVAILABLE"); if (result.rateLimited) fail("RATE_LIMITED"); return { updated: result.updated, pending: result.pending };
}

export async function deleteUpload(userId: string, uploadId: string): Promise<void> {
  await getUpload(userId, uploadId); await adminStorage.removePrefix(`${userId}/${uploadId}/`); const supabase = await createServerSupabase(); const { error } = await supabase.from("uploads").delete().eq("user_id", userId).eq("id", uploadId); db(error);
}
