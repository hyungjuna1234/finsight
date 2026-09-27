import type { Metadata } from "next";
import { LegalDocument } from "@/components/marketing/legal/legal-document";
import { RefundPolicy } from "@/components/marketing/legal/refund-policy";

export const metadata: Metadata = { title: "환불 정책" };

export default function RefundPage() {
  return <LegalDocument title="환불 정책"><RefundPolicy /></LegalDocument>;
}
