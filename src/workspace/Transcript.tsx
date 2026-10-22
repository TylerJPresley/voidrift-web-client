/**
 * The streaming transcript (web-blueprint.md §5.1, §8, §9).
 *
 * Renders turns from reduced view state: the conversation is a labeled `log`
 * region announced through a polite `aria-live` region so a screen reader
 * follows the agent without re-reading (§9). Each turn is a discrete `article`.
 * Tool rows open/close; a diff renders as a colored diff view; reasoning is a
 * disclosure and is never persisted in the transcript text (§8). Color is never
 * the sole carrier of state — status carries text, not color alone (§9).
 */
import { useState } from "react";
import type { TranscriptTurn, ToolRow } from "../events/wire.js";
import { sanitizeText } from "./sanitize-text.js";

export interface TranscriptProps {
  readonly turns: readonly TranscriptTurn[];
  readonly contextPercentage: number;
  readonly reduceMotion?: boolean;
}

export function Transcript(props: TranscriptProps): React.JSX.Element {
  return (
    <main>
      <section aria-label="Conversation" role="log" aria-live="polite" aria-relevant="additions text">
        {props.turns.map((turn) => (
          <TurnArticle key={turn.id} turn={turn} />
        ))}
      </section>
      <ContextMeter percentage={props.contextPercentage} />
    </main>
  );
}

function TurnArticle({ turn }: { turn: TranscriptTurn }): React.JSX.Element {
  return (
    <article aria-label={`${turn.role} message`}>
      <p dir="auto">{sanitizeText(turn.text)}</p>
      {turn.reasoning ? <Reasoning text={turn.reasoning} /> : null}
      {turn.tools.map((t) => (
        <ToolRowView key={t.id} tool={t} />
      ))}
    </article>
  );
}

function Reasoning({ text }: { text: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <details open={open}>
      <summary onClick={() => setOpen((o) => !o)}>Reasoning</summary>
      <pre dir="auto">{sanitizeText(text)}</pre>
    </details>
  );
}

function ToolRowView({ tool }: { tool: ToolRow }): React.JSX.Element {
  return (
    <div role="group" aria-label={`Tool ${tool.name} ${tool.status}`}>
      <span>
        {statusIcon(tool.status)} {tool.name} — {tool.status}
      </span>
      <span dir="auto">{sanitizeText(tool.argsSummary)}</span>
      {tool.diff ? <DiffView diff={tool.diff} /> : null}
      {tool.summary ? <span dir="auto">{sanitizeText(tool.summary)}</span> : null}
    </div>
  );
}

/** A colored diff view (§8). Each line carries a textual +/- marker so color is
 * never the sole carrier of meaning (§9 contrast). */
export function DiffView({ diff }: { diff: string }): React.JSX.Element {
  const lines = diff.split("\n");
  return (
    <pre aria-label="diff">
      {lines.map((line, i) => {
        const kind = line.startsWith("+") ? "added" : line.startsWith("-") ? "removed" : "context";
        return (
          <div key={i} data-diff={kind} dir="auto">
            {sanitizeText(line)}
          </div>
        );
      })}
    </pre>
  );
}

function ContextMeter({ percentage }: { percentage: number }): React.JSX.Element {
  return (
    <div
      role="progressbar"
      aria-label="Context occupancy"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      Context: {Math.round(percentage)}%
    </div>
  );
}

function statusIcon(status: ToolRow["status"]): string {
  if (status === "running") return "…";
  if (status === "error") return "✗";
  return "✓";
}
