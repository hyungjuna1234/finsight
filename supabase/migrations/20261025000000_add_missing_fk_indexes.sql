-- db-advisor 2026-10-25: unindexed_foreign_keys (consents.user_id, transactions.card_id,
-- transactions.upload_id, uploads.card_id) — docs/security/db-advisor-2026-10-25.md
create index consents_user_id_idx on public.consents (user_id);
create index transactions_card_id_idx on public.transactions (card_id);
create index transactions_upload_id_idx on public.transactions (upload_id);
create index uploads_card_id_idx on public.uploads (card_id);
