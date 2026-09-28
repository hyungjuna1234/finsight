import { err, ok, type Result } from "@/lib/domain/result";
import { getDocumentProxy } from "unpdf";

import type { PdfText } from "./pdf-table";

// PDF는 표가 아니라 "위치가 있는 글자 조각"이다. 여기서는 글자와 좌표만 뽑고, 표로 묶는 일은 pdf-table.ts가 한다.
// 비밀번호는 메모리에서만 쓰고 저장하거나 로그에 남기지 않는다.

export const PDF_LIMITS = { maxPages: 50 } as const;

export type PdfError = "PDF_PASSWORD_REQUIRED" | "PDF_PASSWORD_WRONG" | "CORRUPT_FILE" | "FILE_TOO_COMPLEX";

// pdf.js PasswordResponses: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
function passwordError(error: unknown): PdfError | null {
  if (!error || typeof error !== "object" || (error as { name?: unknown }).name !== "PasswordException") return null;
  return (error as { code?: unknown }).code === 2 ? "PDF_PASSWORD_WRONG" : "PDF_PASSWORD_REQUIRED";
}

function horizontal(transform: number[]): boolean {
  return Math.abs(transform[1] ?? 0) < 0.01 && Math.abs(transform[2] ?? 0) < 0.01 && (transform[0] ?? 0) > 0;
}

export async function readPdf(bytes: Uint8Array, password: string | null): Promise<Result<PdfText[][], PdfError>> {
  let document: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js는 넘긴 버퍼를 가져가므로(transfer) 복사본을 준다.
    document = await getDocumentProxy(bytes.slice(), {
      password: password ?? undefined,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
  } catch (error) {
    return err(passwordError(error) ?? "CORRUPT_FILE");
  }
  try {
    if (document.numPages > PDF_LIMITS.maxPages) return err("FILE_TOO_COMPLEX");
    const pages: PdfText[][] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const content = await (await document.getPage(pageNumber)).getTextContent();
      const items: PdfText[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim() || !horizontal(item.transform)) continue;
        items.push({ text: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, width: item.width, height: item.height });
      }
      pages.push(items);
    }
    return ok(pages);
  } catch {
    return err("CORRUPT_FILE");
  } finally {
    await document.loadingTask.destroy().catch(() => undefined);
  }
}
