// 공유 미리보기(OG) 이미지의 절대 URL 기준. env가 없거나 잘못되면 undefined로 두어 빌드를 막지 않는다.
export function parseSiteUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}
