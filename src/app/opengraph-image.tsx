import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getLandingShowcase } from "@/lib/demo/landing";

export const alt = "FinSight — 파일 하나로 보는 AI 지출 정리";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const pretendardBold = await readFile(join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf"));
const pretendardSemiBold = await readFile(join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-SemiBold.otf"));

export default function OpenGraphImage() {
  const showcase = getLandingShowcase();
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 56, padding: "68px 72px", background: "#F6F7F5", color: "#18201C", fontFamily: "Pretendard" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#0E6B55" }}>FinSight</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 60, fontWeight: 700, lineHeight: 1.18, letterSpacing: "-2px" }}>
          <div style={{ display: "flex" }}>월급이 어디로 새는지,</div>
          <div style={{ display: "flex" }}>파일 하나로 AI가 찾아 드려요</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#3B4540" }}>연동 없이 카드 이용내역 파일만 올리면 돼요</div>
      </div>
      <div style={{ width: 420, minHeight: 390, display: "flex", flexDirection: "column", justifyContent: "center", borderRadius: 16, padding: "38px 36px", background: "#18201C" }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#AEB8B2" }}>AI 리포트 · 예시</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 30, fontWeight: 600, lineHeight: 1.45, color: "#FFFFFF" }}>{showcase.report.content.headline}</div>
        {showcase.increase ? <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1, color: "#FF907F" }}>+{showcase.increase.rate}%</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 24, color: "#C9D1CC" }}>{showcase.increase.category} · 지난달보다</div>
        </div> : null}
      </div>
    </div>,
    { ...size, fonts: [
      { name: "Pretendard", data: pretendardBold, style: "normal", weight: 700 },
      { name: "Pretendard", data: pretendardSemiBold, style: "normal", weight: 600 },
    ] },
  );
}
