import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("PGlite RLS support", () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
  });

  it("filters rows through auth.uid() for a non-superuser role", async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table rls_probe (id uuid primary key, user_id uuid not null);
      alter table rls_probe enable row level security;
      create policy rls_probe_owner on rls_probe
        to authenticated
        using ((select auth.uid()) = user_id);
      grant select on rls_probe to authenticated;
      insert into rls_probe (id, user_id) values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${USER_A}'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${USER_B}');
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${USER_A}', false);
    `);

    const own = await db.query<{ id: string }>(
      "select id from rls_probe where user_id = $1",
      [USER_A],
    );
    const other = await db.query<{ id: string }>(
      "select id from rls_probe where user_id = $1",
      [USER_B],
    );

    expect(own.rows).toHaveLength(1);
    expect(other.rows).toHaveLength(0);
  });
});
