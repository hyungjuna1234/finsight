import { ProLock } from "@/components/pro/pro-lock";
import { ExampleQuestions } from "./example-questions";

export function ChatTeaser({ examples }: { examples: readonly string[] }) {
  return <section className="space-y-3"><p className="text-sm text-body">Pro에서 내 지출에 대해 물어볼 수 있어요</p><div className="opacity-40 select-none"><ExampleQuestions examples={examples} /></div><ProLock message="Pro에서 지출 Q&A를 이용할 수 있어요" from="chat" /></section>;
}
