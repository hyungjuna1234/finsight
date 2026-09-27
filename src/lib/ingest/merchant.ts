const PREFIXES = [
  /^KCP[-_\s]*/i,
  /^NICE[-_\s]*/i,
  /^KSNET[-_\s]*/i,
  /^\(주\)\s*/,
  /^㈜\s*/,
  /^주식회사\s*/,
  /^네이버페이\s*/,
  /^NAVERPAY\s*/i,
  /^카카오페이[_\s]*/,
  /^PAYCO\s*/i,
  /^토스페이\s*/,
] as const;

export function normalizeMerchant(raw: string): string {
  let value = raw.normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of PREFIXES) {
      const next = value.replace(prefix, "").trimStart();
      if (next !== value) {
        value = next;
        changed = true;
      }
    }
  }
  value = value.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "").trim().slice(0, 100);
  return value || "알 수 없음";
}
