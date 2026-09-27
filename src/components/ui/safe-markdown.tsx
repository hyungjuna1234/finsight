import Markdown from "react-markdown";

export const SAFE_MARKDOWN_ELEMENTS = ["p", "strong", "em", "ul", "ol", "li", "code", "table", "thead", "tbody", "tr", "th", "td", "br"] as const;

export function SafeMarkdown({ text }: { text: string }): React.ReactElement {
  return (
    <div className="text-sm leading-relaxed text-body [&_code]:tabular-nums [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc">
      <Markdown allowedElements={SAFE_MARKDOWN_ELEMENTS} unwrapDisallowed skipHtml>{text}</Markdown>
    </div>
  );
}
