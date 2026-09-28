import type { YearMonth } from "./types";

export interface JourneyInput {
  isPro: boolean;
  monthsWithData: number;
  freeInsightAvailable: boolean;
  staleMonth: YearMonth | null;
  hasInsightThisMonth: boolean;
}

export type StepKey = "signup" | "first_upload" | "three_months" | "first_insight";
export type JourneyPrimary = "stale_upload" | StepKey | "pro_insight" | "pro_upgrade";

export interface ChecklistItem {
  key: StepKey;
  done: boolean;
  progress?: { now: number; goal: number };
}

export interface Journey {
  checklist: ChecklistItem[] | null;
  primary: JourneyPrimary | null;
}

export function buildJourney(input: JourneyInput): Journey {
  const items: ChecklistItem[] = [
    { key: "signup", done: true },
    { key: "first_upload", done: input.monthsWithData >= 1 },
    {
      key: "three_months",
      done: input.monthsWithData >= 3,
      progress: { now: Math.min(input.monthsWithData, 3), goal: 3 },
    },
    { key: "first_insight", done: !input.freeInsightAvailable },
  ];
  const incomplete = items.find((item) => !item.done);
  const checklist = input.isPro || !incomplete ? null : items;

  if (input.staleMonth) return { checklist, primary: "stale_upload" };
  if (!input.isPro && incomplete) return { checklist, primary: incomplete.key };
  if (input.isPro && !input.hasInsightThisMonth) return { checklist, primary: "pro_insight" };
  if (!input.isPro) return { checklist, primary: "pro_upgrade" };
  return { checklist, primary: null };
}
