import { createHash } from "node:crypto";

import type { IsoDate, KRW, TxKind } from "@/lib/domain/types";

export function identityKey(input: {
  userId: string;
  cardId: string;
  approvalNo: string | null;
  occurredOn: IsoDate;
  kind: TxKind;
  merchantKey: string;
  amountKrw: KRW;
  occurrence: number;
}): string {
  const fields: Array<string | number> = input.approvalNo
    ? ["v1", "a", input.userId, input.cardId, input.approvalNo, input.occurredOn, input.kind]
    : ["v1", "n", input.userId, input.cardId, input.occurredOn, input.merchantKey, input.amountKrw, input.kind, input.occurrence];
  if (input.approvalNo && input.occurrence > 0) fields.push(input.occurrence);
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}
