import type { AcceptedExtension } from "@/lib/domain/upload";
import { fileExtension } from "@/lib/domain/upload";
import { err, ok, type Result } from "@/lib/domain/result";

export type SniffKind = "xlsx" | "xls" | "html" | "xml" | "text" | "pdf";
export type TextEncoding = "utf-8" | "utf-16le" | "utf-16be";

export interface Sniff {
  kind: SniffKind;
  extension: AcceptedExtension;
  encoding: TextEncoding | null;
}

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function containsBytes(bytes: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let part = 0; part < needle.length; part += 1) {
      if (bytes[index + part] !== needle[part]) continue outer;
    }
    return true;
  }
  return false;
}

function utf16Le(text: string): Uint8Array {
  const result = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    result[index * 2] = code & 0xff;
    result[index * 2 + 1] = code >> 8;
  }
  return result;
}

function encodingFromBom(bytes: Uint8Array): TextEncoding | null {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) return "utf-8";
  if (startsWith(bytes, [0xff, 0xfe])) return "utf-16le";
  if (startsWith(bytes, [0xfe, 0xff])) return "utf-16be";
  return null;
}

function inferredUtf16(bytes: Uint8Array): TextEncoding | null {
  const length = Math.min(bytes.length, 512);
  let evenZeros = 0;
  let oddZeros = 0;
  let evenCount = 0;
  let oddCount = 0;
  for (let index = 0; index < length; index += 1) {
    if (index % 2 === 0) {
      evenCount += 1;
      if (bytes[index] === 0) evenZeros += 1;
    } else {
      oddCount += 1;
      if (bytes[index] === 0) oddZeros += 1;
    }
  }
  if (oddCount > 0 && oddZeros / oddCount >= 0.3) return "utf-16le";
  if (evenCount > 0 && evenZeros / evenCount >= 0.3) return "utf-16be";
  return null;
}

function textPrefix(bytes: Uint8Array, encoding: TextEncoding | null): string {
  try {
    return new TextDecoder(encoding ?? "utf-8").decode(bytes.subarray(0, 8192)).replace(/^\uFEFF/, "");
  } catch {
    return Array.from(bytes.subarray(0, 8192), (byte) => String.fromCharCode(byte)).join("");
  }
}

function onlyBomAndWhitespace(bytes: Uint8Array): boolean {
  const encoding = encodingFromBom(bytes) ?? inferredUtf16(bytes);
  const text = textPrefix(bytes, encoding);
  return text.trim().length === 0;
}

export function sniffFile(
  bytes: Uint8Array,
  filename: string,
): Result<Sniff, "UNSUPPORTED_FORMAT" | "ENCRYPTED_FILE" | "EMPTY_FILE"> {
  const extension = fileExtension(filename);
  if (!extension) return err("UNSUPPORTED_FORMAT");
  if (bytes.length === 0 || onlyBomAndWhitespace(bytes)) return err("EMPTY_FILE");

  const pdf = startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (extension === "pdf") return pdf ? ok({ kind: "pdf", extension, encoding: null }) : err("UNSUPPORTED_FORMAT");
  if (
    pdf ||
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
    startsWith(bytes, [0xff, 0xd8, 0xff]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) ||
    startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)
  ) {
    return err("UNSUPPORTED_FORMAT");
  }

  if (startsWith(bytes, CFB_MAGIC)) {
    if (
      containsBytes(bytes, utf16Le("EncryptionInfo")) ||
      containsBytes(bytes, utf16Le("EncryptedPackage"))
    ) {
      return err("ENCRYPTED_FILE");
    }
    return ok({ kind: "xls", extension, encoding: null });
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return ok({ kind: "xlsx", extension, encoding: null });
  }

  const encoding = encodingFromBom(bytes) ?? inferredUtf16(bytes);
  const prefix = textPrefix(bytes, encoding);
  const trimmed = prefix.trimStart().toLowerCase();
  if (
    trimmed.startsWith("<?xml") &&
    (trimmed.includes("urn:schemas-microsoft-com:office:spreadsheet") || trimmed.includes("<workbook"))
  ) {
    return ok({ kind: "xml", extension, encoding });
  }
  if (["<html", "<!doctype html", "<table", "<meta"].some((tag) => trimmed.startsWith(tag))) {
    return ok({ kind: "html", extension, encoding });
  }
  if (!encoding && bytes.subarray(0, 8192).includes(0)) return err("UNSUPPORTED_FORMAT");
  return ok({ kind: "text", extension, encoding });
}
