import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const testsDirectory = fileURLToPath(new URL(".", import.meta.url));
const migrationUrl = new URL("../migrations/20260926000000_init.sql", import.meta.url);

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  const [stubs, migration] = await Promise.all([
    readFile(`${testsDirectory}stubs.sql`, "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);
  await db.exec(stubs);
  await db.exec(migration);
  return db;
}

async function switchRole(db: PGlite, role: "anon" | "authenticated" | "service_role", uid = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec(`set role ${role}`);
}

export async function asUser(db: PGlite, uid: string): Promise<void> {
  await switchRole(db, "authenticated", uid);
}

export async function asAnon(db: PGlite): Promise<void> {
  await switchRole(db, "anon");
}

export async function asService(db: PGlite): Promise<void> {
  await switchRole(db, "service_role");
}

export async function asOwner(db: PGlite): Promise<void> {
  await db.exec("reset role");
}
