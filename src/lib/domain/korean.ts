function hasFinalConsonant(word: string): boolean {
  const lastCharacter = word.at(-1);
  if (!lastCharacter) return false;

  const codePoint = lastCharacter.codePointAt(0)!;
  return codePoint >= 0xac00 && codePoint <= 0xd7a3 && (codePoint - 0xac00) % 28 !== 0;
}

export function withTopic(word: string): string {
  return `${word}${hasFinalConsonant(word) ? "은" : "는"}`;
}

export function withSubject(word: string): string {
  return `${word}${hasFinalConsonant(word) ? "이" : "가"}`;
}
