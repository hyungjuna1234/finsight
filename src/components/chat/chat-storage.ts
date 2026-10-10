// 대화는 이 탭의 sessionStorage에만 잠시 둔다. 공용 PC의 같은 탭에서 다음 사용자가 이전 사용자의
// 대화(가맹점·금액)를 보지 않도록 키를 사용자별로 나누고, 로그아웃할 때와 다른 사용자가 열 때 지운다.

const PREFIX = "finsight.chat.";

export function chatStorageKey(ownerId: string): string {
  return `${PREFIX}v1:${ownerId}`;
}

function chatKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function clearChatStorage(): void {
  try {
    for (const key of chatKeys()) sessionStorage.removeItem(key);
  } catch {
    // 저장소를 쓸 수 없는 환경(차단된 쿠키·프라이빗 모드)에서는 지울 것도 없다.
  }
}

export function pruneChatStorage(ownerId: string): void {
  const keep = chatStorageKey(ownerId);
  try {
    for (const key of chatKeys()) if (key !== keep) sessionStorage.removeItem(key);
  } catch {
    // clearChatStorage와 같다.
  }
}
