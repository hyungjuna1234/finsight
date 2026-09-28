import { createCipheriv, createHash } from "node:crypto";

// 테스트용 PDF를 코드로 합성한다(실제 명세서는 레포에 넣지 않는다).
// 글꼴은 Helvetica라 ASCII 글자만 쓴다. 한글 배치는 pdf-table 테스트에서 PdfText로 직접 만든다.
// password를 주면 실제 카드사 PDF(NH 샘플)와 같은 표준 보안 처리기 V4/R4 AESV2(128비트)로 암호화한다.

export interface PdfFixtureText { text: string; x: number; y: number; size?: number }

const PADDING = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");
const FILE_ID = createHash("md5").update("finsight-pdf-fixture").digest();
const PERMISSIONS = -4;

function md5(...parts: Uint8Array[]): Buffer {
  const hash = createHash("md5");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function rc4(key: Uint8Array, data: Uint8Array): Buffer {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i]! + key[i % key.length]!) & 0xff;
    [state[i], state[j]] = [state[j]!, state[i]!];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xff;
    j = (j + state[i]!) & 0xff;
    [state[i], state[j]] = [state[j]!, state[i]!];
    out[index] = data[index]! ^ state[(state[i]! + state[j]!) & 0xff]!;
  }
  return out;
}

function rc4Rounds(key: Buffer, data: Buffer): Buffer {
  let out = rc4(key, data);
  for (let round = 1; round <= 19; round += 1) out = rc4(key.map((byte) => byte ^ round), out);
  return out;
}

function padded(password: string): Buffer {
  const bytes = Buffer.from(password, "latin1").subarray(0, 32);
  return Buffer.concat([bytes, PADDING.subarray(0, 32 - bytes.length)]);
}

function standardSecurity(password: string): { key: Buffer; owner: Buffer; user: Buffer } {
  let ownerHash = md5(padded(password));
  for (let round = 0; round < 50; round += 1) ownerHash = md5(ownerHash);
  const owner = rc4Rounds(ownerHash.subarray(0, 16), padded(password));
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(PERMISSIONS);
  let key = md5(padded(password), owner, permissions, FILE_ID);
  for (let round = 0; round < 50; round += 1) key = md5(key.subarray(0, 16));
  key = key.subarray(0, 16);
  const user = Buffer.concat([rc4Rounds(key, md5(PADDING, FILE_ID)), Buffer.alloc(16)]);
  return { key, owner, user };
}

function encryptStream(key: Buffer, objectNumber: number, data: Buffer): Buffer {
  const objectSuffix = Buffer.from([objectNumber & 0xff, (objectNumber >> 8) & 0xff, (objectNumber >> 16) & 0xff, 0, 0]);
  const objectKey = md5(key, objectSuffix, Buffer.from("sAlT", "latin1")).subarray(0, 16);
  const iv = md5(Buffer.from(`iv-${objectNumber}`)).subarray(0, 16);
  const cipher = createCipheriv("aes-128-cbc", objectKey, iv);
  return Buffer.concat([iv, cipher.update(data), cipher.final()]);
}

function escapeText(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function syntheticPdf(pages: PdfFixtureText[][], options: { password?: string } = {}): Uint8Array {
  const security = options.password === undefined ? null : standardSecurity(options.password);
  const objects: Buffer[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const encryptId = 4 + pages.length * 2;
  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  pages.forEach((items, index) => {
    const pageId = pageIds[index]!;
    const contentId = pageId + 1;
    objects[pageId] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const plain = Buffer.from(items.map((item) => `BT /F1 ${item.size ?? 8} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${escapeText(item.text)}) Tj ET\n`).join(""), "latin1");
    const data = security ? encryptStream(security.key, contentId, plain) : plain;
    objects[contentId] = Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`), data, Buffer.from("\nendstream")]);
  });
  if (security) {
    objects[encryptId] = Buffer.from(`<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV2 /Length 16 >> >> /StmF /StdCF /StrF /StdCF /O <${security.owner.toString("hex")}> /U <${security.user.toString("hex")}> /P ${PERMISSIONS} >>`);
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let length = chunks[0]!.length;
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    const body = objects[id]!;
    const chunk = Buffer.concat([Buffer.from(`${id} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
    offsets[id] = length;
    chunks.push(chunk);
    length += chunk.length;
  }
  const xref = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`, ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)].join("");
  const id = FILE_ID.toString("hex");
  const trailer = `trailer\n<< /Size ${objects.length} /Root 1 0 R${security ? ` /Encrypt ${encryptId} 0 R` : ""} /ID [<${id}> <${id}>] >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer));
  return new Uint8Array(Buffer.concat(chunks));
}
