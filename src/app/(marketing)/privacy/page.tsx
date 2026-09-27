import type { Metadata } from "next";
import { LegalDocument } from "@/components/marketing/legal/legal-document";
import { PrivacyPolicy } from "@/components/marketing/legal/privacy-policy";

export const metadata: Metadata = { title: "개인정보 처리방침" };

export default function PrivacyPage() {
  return <LegalDocument title="개인정보 처리방침"><PrivacyPolicy /></LegalDocument>;
}
