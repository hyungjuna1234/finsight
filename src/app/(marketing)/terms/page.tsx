import type { Metadata } from "next";
import { LegalDocument } from "@/components/marketing/legal/legal-document";
import { TermsOfService } from "@/components/marketing/legal/terms-of-service";

export const metadata: Metadata = { title: "이용약관" };

export default function TermsPage() {
  return <LegalDocument title="이용약관"><TermsOfService /></LegalDocument>;
}
