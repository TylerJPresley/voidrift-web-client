/**
 * The authenticated shell (web-blueprint.md §8, §9).
 *
 * Server-rendered for a fast first paint, then hydrated to run over the relay
 * (§8). Composes the semantic landmarks: a `nav` of conversations, the `main`
 * transcript as a labeled live region, the composer form, and the focus-trapped
 * approval dialog when a `PendingApproval` is active. Holds VIEW state only
 * (§1.1); all actions go through the injected `ActionClient` and all updates
 * arrive via the reduced event state.
 */
import { useRef } from "react";
import type { ConversationState } from "../events/reducer.js";
import type { SessionInfo, ApprovalResponse } from "../events/wire.js";
import { SessionList, Composer } from "../workspace/SessionList.js";
import { Transcript } from "../workspace/Transcript.js";
import { ConfirmationDialog } from "../approvals/ConfirmationDialog.js";

export interface ShellProps {
  readonly sessions: readonly SessionInfo[];
  readonly activeId: string | null;
  readonly state: ConversationState;
  readonly reduceMotion?: boolean;
  readonly onSelect: (id: string) => void;
  readonly onNew: () => void;
  readonly onSend: (text: string) => void;
  readonly onDecision: (response: ApprovalResponse) => void;
}

export function Shell(props: ShellProps): React.JSX.Element {
  const composerTrigger = useRef<HTMLElement>(null);
  return (
    <div data-reduce-motion={props.reduceMotion ? "true" : "false"}>
      <a href="#composer-input">Skip to composer</a>
      <SessionList
        sessions={props.sessions}
        activeId={props.activeId}
        onSelect={props.onSelect}
        onNew={props.onNew}
      />
      <Transcript
        turns={props.state.turns}
        contextPercentage={props.state.contextPercentage}
        {...(props.reduceMotion !== undefined ? { reduceMotion: props.reduceMotion } : {})}
      />
      {props.state.error ? (
        <div role="alert" aria-live="assertive">
          {props.state.error}
        </div>
      ) : null}
      <Composer disabled={props.state.pending !== null} onSubmit={props.onSend} />
      {props.state.pending ? (
        <ConfirmationDialog
          approval={props.state.pending}
          onDecision={props.onDecision}
          returnFocusRef={composerTrigger}
        />
      ) : null}
    </div>
  );
}
