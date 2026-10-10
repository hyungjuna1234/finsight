import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatTeaser } from "@/components/chat/chat-teaser";
import { CHAT_EXAMPLES } from "@/lib/domain/chat";
import { getChatViewer } from "@/server/queries/plan";

export default async function ChatPage() {
  const viewer = await getChatViewer();
  return <main className="space-y-8"><h1 className="text-2xl font-semibold text-ink">지출 Q&amp;A</h1>{viewer.isPro ? <ChatPanel ownerId={viewer.ownerId} examples={CHAT_EXAMPLES} /> : <ChatTeaser examples={CHAT_EXAMPLES} />}</main>;
}
