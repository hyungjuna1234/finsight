export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

type TransactionInsert = {
  id?: string;
  user_id: string;
  card_id?: string | null;
  upload_id: string;
  occurred_on: string;
  merchant_raw: string;
  merchant_key: string;
  amount_krw: number;
  kind: "spend" | "refund";
  status: "posted" | "pending" | "cancelled";
  installment_months?: number | null;
  foreign_amount?: number | null;
  foreign_currency?: string | null;
  approval_no?: string | null;
  category: string;
  category_source: "user" | "history" | "rule" | "ai" | "pending";
  identity_key: string;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      consents: Table<{ id: string; user_id: string; kind: "privacy" | "overseas_transfer" | "terms" | "age14"; version: string; agreed_at: string }, { id?: string; user_id: string; kind: "privacy" | "overseas_transfer" | "terms" | "age14"; version: string; agreed_at?: string }, { id?: string; user_id?: string; kind?: "privacy" | "overseas_transfer" | "terms" | "age14"; version?: string; agreed_at?: string }>;
      entitlements: Table<{ user_id: string; plan: "free" | "pro"; status: string; period_end: string | null; synced_at: string | null; free_insight_used_at: string | null }, { user_id: string; plan?: "free" | "pro"; status?: string; period_end?: string | null; synced_at?: string | null; free_insight_used_at?: string | null }, { user_id?: string; plan?: "free" | "pro"; status?: string; period_end?: string | null; synced_at?: string | null; free_insight_used_at?: string | null }>;
      cards: Table<{ id: string; user_id: string; name: string; institution: string | null; created_at: string }, { id?: string; user_id: string; name: string; institution?: string | null; created_at?: string }, { id?: string; user_id?: string; name?: string; institution?: string | null; created_at?: string }>;
      uploads: Table<{ id: string; user_id: string; card_id: string | null; storage_path: string; filename: string; sha256: string; byte_size: number; status: "uploaded" | "awaiting_confirm" | "done" | "failed"; error_code: string | null; mapping: Json | null; header_signature: string | null; period_from: string | null; period_to: string | null; counts: Json | null; original_deleted_at: string | null; created_at: string }, { id?: string; user_id: string; card_id?: string | null; storage_path: string; filename: string; sha256: string; byte_size: number; status: "uploaded" | "awaiting_confirm" | "done" | "failed"; error_code?: string | null; mapping?: Json | null; header_signature?: string | null; period_from?: string | null; period_to?: string | null; counts?: Json | null; original_deleted_at?: string | null; created_at?: string }, { id?: string; user_id?: string; card_id?: string | null; storage_path?: string; filename?: string; sha256?: string; byte_size?: number; status?: "uploaded" | "awaiting_confirm" | "done" | "failed"; error_code?: string | null; mapping?: Json | null; header_signature?: string | null; period_from?: string | null; period_to?: string | null; counts?: Json | null; original_deleted_at?: string | null; created_at?: string }>;
      transactions: Table<{ id: string; user_id: string; card_id: string | null; upload_id: string; occurred_on: string; merchant_raw: string; merchant_key: string; amount_krw: number; kind: "spend" | "refund"; status: "posted" | "pending" | "cancelled"; installment_months: number | null; foreign_amount: number | null; foreign_currency: string | null; approval_no: string | null; category: string; category_source: "user" | "history" | "rule" | "ai" | "pending"; identity_key: string; created_at: string }, TransactionInsert, Partial<TransactionInsert>>;
      header_mappings: Table<{ user_id: string; signature: string; mapping: Json; updated_at: string }, { user_id: string; signature: string; mapping: Json; updated_at?: string }, { user_id?: string; signature?: string; mapping?: Json; updated_at?: string }>;
      category_overrides: Table<{ user_id: string; merchant_key: string; category: string }, { user_id: string; merchant_key: string; category: string }, { user_id?: string; merchant_key?: string; category?: string }>;
      insights: Table<{ id: string; user_id: string; month: string; content: Json; created_at: string }, { id?: string; user_id: string; month: string; content: Json; created_at?: string }, { id?: string; user_id?: string; month?: string; content?: Json; created_at?: string }>;
      ai_usage: Table<{ id: string; user_id: string; feature: "mapping" | "classify" | "insight" | "chat"; model: string; input_tokens: number; output_tokens: number; created_at: string }, { id?: string; user_id: string; feature: "mapping" | "classify" | "insight" | "chat"; model: string; input_tokens: number; output_tokens: number; created_at?: string }, { id?: string; user_id?: string; feature?: "mapping" | "classify" | "insight" | "chat"; model?: string; input_tokens?: number; output_tokens?: number; created_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
