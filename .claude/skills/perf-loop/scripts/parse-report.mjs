#!/usr/bin/env node
// perf-loop 측정 비교: run-lighthouse.sh가 만든 Lighthouse JSON 리포트들을 읽어
// 페이지별 점수/핵심 지표와 직전 run 대비 변화, 저장 가능 시간이 큰 audit 목록을 뽑는다.
// 새 npm 의존성 없이 순수 Node(JSON.parse)만 쓴다. keep/discard/목표/정체 판단은 이 스크립트가 아니라
// perf-loop SKILL.md가 docs/perf/lighthouse-history.md의 흐름을 보고 직접 내린다 — 여기는 숫자 추출만 한다.
//
// 사용: node parse-report.mjs <currentRunDir> [previousRunDir]
// 출력: stdout에 JSON 한 덩어리.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROUTES = [
  ["/", "index"],
  ["/demo", "demo"],
  ["/pricing", "pricing"],
  ["/guide", "guide"],
  ["/refund", "refund"],
  ["/privacy", "privacy"],
  ["/terms", "terms"],
  ["/login", "login"],
];

const REGRESSION_TOLERANCE = 3; // 점(100점 만점) 이상 떨어지면 regressions에 올린다

function loadReport(dir, slug) {
  const path = join(dir, `${slug}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function metricsFromReport(lhr) {
  if (!lhr) return null;
  const score = lhr.categories?.performance?.score;
  const audits = lhr.audits ?? {};
  const num = (id) => audits[id]?.numericValue ?? null;
  return {
    score: score == null ? null : Math.round(score * 1000) / 10,
    lcp: num("largest-contentful-paint"),
    tbt: num("total-blocking-time"),
    cls: num("cumulative-layout-shift"),
    fcp: num("first-contentful-paint"),
    si: num("speed-index"),
  };
}

function collectOpportunities(lhr, route, byId) {
  if (!lhr) return;
  for (const [id, audit] of Object.entries(lhr.audits ?? {})) {
    const savings = audit.details?.overallSavingsMs;
    if (typeof savings !== "number" || savings <= 0) continue;
    const entry = byId.get(id) ?? { id, title: audit.title, totalSavingsMs: 0, pages: [] };
    entry.totalSavingsMs += savings;
    entry.pages.push({ route, savingsMs: Math.round(savings) });
    byId.set(id, entry);
  }
}

function main() {
  const [currentDir, previousDir] = process.argv.slice(2);
  if (!currentDir) {
    console.error("사용: node parse-report.mjs <currentRunDir> [previousRunDir]");
    process.exit(64);
  }

  const pages = {};
  const opportunities = new Map();
  let scoreSum = 0;
  let scoreCount = 0;
  let prevScoreSum = 0;
  let prevScoreCount = 0;
  const regressions = [];
  const missing = [];

  for (const [route, slug] of ROUTES) {
    const current = metricsFromReport(loadReport(currentDir, slug));
    const previous = previousDir ? metricsFromReport(loadReport(previousDir, slug)) : null;

    if (current?.score == null) {
      missing.push(route);
    } else {
      scoreSum += current.score;
      scoreCount += 1;
    }
    if (previous?.score != null) {
      prevScoreSum += previous.score;
      prevScoreCount += 1;
    }

    const delta =
      current?.score != null && previous?.score != null
        ? Math.round((current.score - previous.score) * 10) / 10
        : null;
    if (delta != null && delta <= -REGRESSION_TOLERANCE) {
      regressions.push({ route, delta });
    }

    pages[route] = { ...current, prevScore: previous?.score ?? null, delta };
    collectOpportunities(loadReport(currentDir, slug), route, opportunities);
  }

  const average = {
    score: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    prevScore: prevScoreCount ? Math.round((prevScoreSum / prevScoreCount) * 10) / 10 : null,
  };
  average.delta =
    average.score != null && average.prevScore != null
      ? Math.round((average.score - average.prevScore) * 10) / 10
      : null;

  const topOpportunities = [...opportunities.values()]
    .sort((a, b) => b.totalSavingsMs - a.totalSavingsMs)
    .slice(0, 10)
    .map((o) => ({ ...o, totalSavingsMs: Math.round(o.totalSavingsMs) }));

  console.log(JSON.stringify({ pages, average, regressions, missing, topOpportunities }, null, 2));
}

main();
