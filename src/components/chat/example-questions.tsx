export function ExampleQuestions({ examples, onPick, disabled = false }: { examples: readonly string[]; onPick?: (question: string) => void; disabled?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {examples.map((example) => <li key={example}>{onPick ? <button type="button" disabled={disabled} onClick={() => onPick(example)} className="rounded-md border border-line bg-surface px-3 py-2 text-left text-sm text-body hover:bg-bg disabled:text-disabled">{example}</button> : <span className="text-sm text-body">{example}</span>}</li>)}
    </ul>
  );
}
