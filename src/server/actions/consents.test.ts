import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_VERSION } from "@/lib/domain/consent";

const { createServerSupabaseMock, insertMock, selectMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  insertMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("@/services/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));

import { getConsentStatus, recordConsents } from "./consents";

const allKinds = ["privacy", "overseas_transfer", "terms", "age14"] as const;

describe("consent actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerSupabaseMock.mockResolvedValue({
      from: vi.fn(() => ({ insert: insertMock, select: selectMock })),
    });
    insertMock.mockResolvedValue({ error: null });
    selectMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) });
  });

  it("inserts each current consent as its own row", async () => {
    await recordConsents("user-1", [...allKinds]);

    expect(insertMock).toHaveBeenCalledWith(allKinds.map((kind) => ({
      user_id: "user-1",
      kind,
      version: CONSENT_VERSION,
    })));
  });

  it("rejects a missing age agreement as UNDERAGE", async () => {
    await expect(recordConsents("user-1", ["privacy", "overseas_transfer", "terms"]))
      .rejects.toMatchObject({ code: "UNDERAGE" });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("rejects other missing required agreements as invalid input", async () => {
    await expect(recordConsents("user-1", ["privacy", "terms", "age14"]))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("returns missing current-version consent kinds", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { kind: "privacy", version: CONSENT_VERSION },
        { kind: "terms", version: "2025-01" },
      ],
      error: null,
    });
    selectMock.mockReturnValue({ eq: eqMock });

    await expect(getConsentStatus("user-1")).resolves.toEqual({
      missing: ["overseas_transfer", "terms", "age14"],
    });
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-1");
  });
});
