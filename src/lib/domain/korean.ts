export function withTopic(word: string): string {
  const lastCharacter = word.at(-1);
  if (!lastCharacter) return `${word}는`;

  const codePoint = lastCharacter.codePointAt(0)!;
  const isHangulSyllable = codePoint >= 0xac00 && codePoint <= 0xd7a3;
  const hasFinalConsonant = isHangulSyllable && (codePoint - 0xac00) % 28 !== 0;
  return `${word}${hasFinalConsonant ? "은" : "는"}`;
}
