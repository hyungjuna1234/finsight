import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const expectedDurations = {
  "src/app/api/uploads/[id]/analyze/route.ts": 60,
  "src/app/api/uploads/[id]/confirm/route.ts": 120,
  "src/app/api/uploads/[id]/recategorize/route.ts": 120,
  "src/app/api/chat/route.ts": 60,
  "src/app/api/insights/route.ts": 120,
  "src/app/api/billing/checkout/route.ts": 30,
  "src/app/api/billing/portal/route.ts": 30,
  "src/app/api/billing/confirm/route.ts": 30,
  "src/app/api/webhooks/polar/route.ts": 30,
  "src/app/api/account/delete/route.ts": 60,
  "src/app/api/cron/cleanup/route.ts": 60,
} as const;

describe("long-running route configuration", () => {
  for (const [path, seconds] of Object.entries(expectedDurations)) {
    it(`${path} allows ${seconds} seconds`, async () => {
      const source = await readFile(resolve(path), "utf8");

      expect(source).toMatch(
        new RegExp(`export\\s+const\\s+maxDuration\\s*=\\s*${seconds}\\s*;?`),
      );
    });
  }
});
