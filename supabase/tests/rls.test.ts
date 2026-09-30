import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asOwner, asService, asUser, createTestDb } from "./db";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const UPLOAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function expectDenied(operation: Promise<unknown>) {
  await expect(operation).rejects.toThrow();
}

describe("database RLS and grants", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
    await db.query("insert into auth.users (id) values ($1), ($2)", [USER_A, USER_B]);
  });

  afterEach(async () => {
    await db.close();
  });

  it("enables RLS on all nine public tables", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    expect(result.rows).toHaveLength(9);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("isolates cards, uploads, transactions, and insights between users", async () => {
    await asUser(db, USER_A);
    const card = await db.query<{ id: string }>("insert into cards (user_id, name) values ($1, 'A 카드') returning id", [USER_A]);
    const cardId = card.rows[0]!.id;
    const upload = await db.query<{ id: string }>("insert into uploads (id, user_id, card_id, storage_path, filename, sha256, byte_size, status) values ($3::uuid, $1::uuid, $2, $1::text || '/' || $3::text || '/original', 'a.csv', 'sha-a', 10, 'uploaded') returning id", [USER_A, cardId, UPLOAD_A]);
    await db.query("insert into transactions (user_id, card_id, upload_id, occurred_on, merchant_raw, merchant_key, amount_krw, kind, status, category, category_source, identity_key) values ($1, $2, $3, '2026-09-01', '상점', '상점', 1000, 'spend', 'posted', '식비', 'rule', 'tx-a')", [USER_A, cardId, upload.rows[0]!.id]);
    await db.query("insert into insights (user_id, month, content) values ($1, '2026-09', '{}')", [USER_A]);

    await asUser(db, USER_B);
    for (const table of ["cards", "uploads", "transactions", "insights"]) {
      const selected = await db.query(`select * from ${table}`);
      const updated = await db.query(`update ${table} set user_id = $1 where user_id = $2`, [USER_B, USER_A]);
      const deleted = await db.query(`delete from ${table} where user_id = $1`, [USER_A]);
      expect(selected.rows).toHaveLength(0);
      expect(updated.affectedRows).toBe(0);
      expect(deleted.affectedRows).toBe(0);
    }
    await expectDenied(db.query("insert into cards (user_id, name) values ($1, '침해 카드')", [USER_A]));
  });

  it("keeps entitlements admin-written and owner-readable", async () => {
    await asService(db);
    await db.query("insert into entitlements (user_id, plan, status) values ($1, 'pro', 'active'), ($2, 'free', 'inactive')", [USER_A, USER_B]);
    await asUser(db, USER_A);
    expect((await db.query("select * from entitlements")).rows).toHaveLength(1);
    expect((await db.query("select cancel_at_period_end from entitlements")).rows).toEqual([{ cancel_at_period_end: false }]);
    await expectDenied(db.query("insert into entitlements (user_id) values ($1)", [USER_A]));
    await expectDenied(db.query("update entitlements set cancel_at_period_end = true where user_id = $1", [USER_A]));
    await expectDenied(db.query("update entitlements set plan = 'free' where user_id = $1", [USER_A]));
  });

  it("allows ai_usage insert/select only for the owner", async () => {
    await asUser(db, USER_A);
    await db.query("insert into ai_usage (user_id, feature, model, input_tokens, output_tokens) values ($1, 'mapping', 'model', 1, 1)", [USER_A]);
    await expectDenied(db.query("insert into ai_usage (user_id, feature, model, input_tokens, output_tokens) values ($1, 'mapping', 'model', 1, 1)", [USER_B]));
    expect((await db.query("select * from ai_usage")).rows).toHaveLength(1);
    await expectDenied(db.query("update ai_usage set input_tokens = 2"));
    await expectDenied(db.query("delete from ai_usage"));
    await asUser(db, USER_B);
    expect((await db.query("select * from ai_usage")).rows).toHaveLength(0);
  });

  it("allows consents insert/select but not update/delete", async () => {
    await asUser(db, USER_A);
    await db.query("insert into consents (user_id, kind, version) values ($1, 'privacy', '1')", [USER_A]);
    expect((await db.query("select * from consents")).rows).toHaveLength(1);
    await expectDenied(db.query("update consents set version = '2'"));
    await expectDenied(db.query("delete from consents"));
  });

  it("gives anon no access to public tables", async () => {
    await asAnon(db);
    for (const table of ["consents", "entitlements", "cards", "uploads", "transactions", "header_mappings", "category_overrides", "insights", "ai_usage"]) {
      await expectDenied(db.query(`select * from ${table}`));
    }
  });

  it("rejects transaction categories outside the domain list", async () => {
    await asUser(db, USER_A);
    const card = await db.query<{ id: string }>("insert into cards (user_id, name) values ($1, 'A 카드') returning id", [USER_A]);
    const upload = await db.query<{ id: string }>("insert into uploads (id, user_id, storage_path, filename, sha256, byte_size, status) values ($2::uuid, $1::uuid, $1::text || '/' || $2::text || '/original', 'a.csv', 'sha-a', 10, 'uploaded') returning id", [USER_A, UPLOAD_A]);
    await expectDenied(db.query("insert into transactions (user_id, card_id, upload_id, occurred_on, merchant_raw, merchant_key, amount_krw, kind, status, category, category_source, identity_key) values ($1, $2, $3, '2026-09-01', '상점', '상점', 1000, 'spend', 'posted', '잘못된 분류', 'rule', 'bad')", [USER_A, card.rows[0]!.id, upload.rows[0]!.id]));
  });

  it("creates only the private statements bucket and no storage policies", async () => {
    await asOwner(db);
    const bucket = await db.query<{ id: string; public: boolean; file_size_limit: number }>("select id, public, file_size_limit from storage.buckets");
    const policies = await db.query("select * from pg_policies where schemaname = 'storage'");
    expect(bucket.rows).toEqual([{ id: "statements", public: false, file_size_limit: 10485760 }]);
    expect(policies.rows).toHaveLength(0);
  });

  it("enforces owner-scoped upload storage paths on insert and update", async () => {
    await asUser(db, USER_A);
    await db.query(
      "insert into uploads (id, user_id, storage_path, filename, sha256, byte_size, status) values ($2::uuid, $1::uuid, $1::text || '/' || $2::text || '/original', 'valid.csv', 'sha-valid', 10, 'uploaded')",
      [USER_A, UPLOAD_A],
    );

    await expect(
      db.query("insert into uploads (user_id, storage_path, filename, sha256, byte_size, status) values ($1, 'x', 'invalid.csv', 'sha-invalid', 10, 'uploaded')", [USER_A]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(db.query("update uploads set storage_path = 'x' where id = $1", [UPLOAD_A])).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query("update uploads set storage_path = $1 || '/' || id || '/original' where id = $2", [USER_B, UPLOAD_A]),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
