import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const testsDirectory = fileURLToPath(new URL(".", import.meta.url));
const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  const [stubs, migrationNames] = await Promise.all([
    readFile(`${testsDirectory}stubs.sql`, "utf8"),
    readdir(migrationsDirectory),
  ]);
  await db.exec(stubs);
  for (const migrationName of migrationNames.filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(`${migrationsDirectory}${migrationName}`, "utf8"));
  }
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
