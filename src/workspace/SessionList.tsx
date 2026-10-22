/**
 * The session list and the message composer (web-blueprint.md §5.1, §9).
 *
 * The session list is a labeled `nav` of the principal-filtered sessions
 * (§4.2 — the server returns only the user's own). The composer is a `form`
 * with a labeled control, operable by keyboard with a visible focus ring (§9).
 */
import { useState } from "react";
import type { SessionInfo } from "../events/wire.js";

export interface SessionListProps {
  readonly sessions: readonly SessionInfo[];
  readonly activeId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onNew: () => void;
}

export function SessionList(props: SessionListProps): React.JSX.Element {
  return (
    <nav aria-label="Conversations">
      <button type="button" onClick={props.onNew}>
        New conversation
      </button>
      <ul>
        {props.sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-current={s.id === props.activeId ? "true" : undefined}
              onClick={() => props.onSelect(s.id)}
            >
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface ComposerProps {
  readonly disabled?: boolean;
  readonly onSubmit: (text: string) => void;
}

export function Composer(props: ComposerProps): React.JSX.Element {
  const [value, setValue] = useState("");
  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    props.onSubmit(text);
    setValue("");
  };
  return (
    <form onSubmit={submit} aria-label="Message composer">
      <label htmlFor="composer-input">Message</label>
      <textarea
        id="composer-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={props.disabled ?? false}
      />
      <button type="submit" disabled={props.disabled ?? false}>
        Send
      </button>
    </form>
  );
}
