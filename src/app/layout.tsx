import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 빌드에 네트워크가 필요 없도록 로컬 폰트를 쓴다 (next/font/google 사용 금지).
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinSight",
  description: "카드 이용내역 파일만 올리면 지출을 정리해 드려요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
