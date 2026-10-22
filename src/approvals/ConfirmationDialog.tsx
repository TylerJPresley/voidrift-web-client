/**
 * The approval dialog (web-blueprint.md §6, §9).
 *
 * Renders the core's `PendingApproval` verbatim — the full `tool`, its `args`,
 * and the `diff` in a diff view — ALREADY masked by the core (§6.1, core
 * §10.10); the browser never reconstructs or un-masks a value (invariant
 * §12.1#5). It is a focus-trapped modal announced assertively so a permission
 * request is never missed (§9); ESC/Reject returns focus to the trigger on
 * close.
 *
 * The FOUR choices (§9.5) are discrete semantic buttons with fixed wording:
 * 'Approve once', 'Approve for this session', 'Save to this project', 'Reject'.
 * When the ask is NOT `rememberable` (a force-ask: dangerous shell, SSRF range,
 * plugin install — absent/undefined is treated as not rememberable, fail
 * closed) only 'Approve once' and 'Reject' are rendered and a short line
 * explains the kind is always asked. 'Save to this project' shows, before the
 * user chooses, the target `.voidrift/config.json` and the exact tool + pattern
 * that will be saved; when several patterns are offered the user picks one
 * (default: the first) from a labelled radio group, and only that offered string
 * is ever sent back as `chosenPattern` (never a forged value).
 */
import { useEffect, useRef, useState } from "react";
import type { PendingApproval, ApprovalResponse } from "../events/wire.js";
import { DiffView } from "../workspace/Transcript.js";

export interface ConfirmationDialogProps {
  readonly approval: PendingApproval;
  readonly onDecision: (response: ApprovalResponse) => void;
  /** The element to restore focus to on close (§9). */
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const PROJECT_CONFIG_PATH = ".voidrift/config.json";

export function ConfirmationDialog(props: ConfirmationDialogProps): React.JSX.Element {
  const { approval } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  // Latch: the first decision wins. A ref guards against a rapid second
  // click/keypress racing the unmount (the parent clears `pending`), and the
  // state flag disables the buttons so a double-send is impossible (§9).
  const decidedRef = useRef(false);
  const [decided, setDecided] = useState(false);

  // A force-ask (not rememberable) offers only approve-once/reject; the core
  // refuses a `remember` for it. Absent/undefined is treated as not rememberable
  // (fail closed).
  const rememberable = approval.rememberable === true;
  const exactOnly = approval.exactOnly === true;
  const patterns = rememberable ? (approval.inferredPatterns ?? []) : [];
  const canPersist = patterns.length > 0;
  // The chosen pattern is ALWAYS one of the offered strings (default: first).
  const [chosen, setChosen] = useState<string>(patterns[0] ?? "");

  useEffect(() => {
    firstButtonRef.current?.focus();
    return () => props.returnFocusRef?.current?.focus();
  }, [props.returnFocusRef]);

  /** Send the decision exactly once; every later call is a no-op. */
  const sendOnce = (response: ApprovalResponse): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    setDecided(true);
    props.onDecision(response);
  };

  const decide = (decision: ApprovalResponse["decision"]): void => {
    sendOnce({ requestId: approval.id, decision });
  };

  // 'Approve for this session' / 'Save to this project' both approve and ask the
  // core to remember; the chosen pattern is only ever one the core offered.
  const remember = (scope: "session" | "project"): void => {
    // Guard: a forged/absent pattern is never sent — fall back to approve-once.
    if (!canPersist || !patterns.includes(chosen)) {
      decide("approve");
      return;
    }
    sendOnce({ requestId: approval.id, decision: "approve", remember: scope, chosenPattern: chosen });
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") decide("reject");
    if (e.key === "Tab") trapFocus(e, dialogRef.current);
  };

  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={`Approve action: ${approval.tool}`}
      aria-live="assertive"
      onKeyDown={onKeyDown}
    >
      <h2>Permission requested</h2>
      <dl>
        <dt>Tool</dt>
        <dd>{approval.tool}</dd>
        <dt>Arguments</dt>
        <dd>
          <pre>{JSON.stringify(approval.args, null, 2)}</pre>
        </dd>
      </dl>
      {approval.diff ? <DiffView diff={approval.diff} /> : null}
      {rememberable ? (
        canPersist ? (
          <fieldset>
            <legend>Save to this project</legend>
            <p>
              Saves to <code>{PROJECT_CONFIG_PATH}</code>: allow <code>{approval.tool}</code> matching{" "}
              <code>{chosen}</code>
            </p>
            {patterns.length > 1 ? (
              <div role="radiogroup" aria-label="Pattern to save">
                {patterns.map((p) => (
                  <label key={p}>
                    <input
                      type="radio"
                      name="chosen-pattern"
                      value={p}
                      checked={chosen === p}
                      onChange={() => setChosen(p)}
                    />{" "}
                    {p}
                  </label>
                ))}
              </div>
            ) : null}
            {exactOnly ? <p data-field="exact-only">{exactOnlyNote(approval.forceAskKind, approval.tool)}</p> : null}
          </fieldset>
        ) : null
      ) : (
        <p data-field="always-ask">This kind of action is always asked.</p>
      )}
      <div role="group" aria-label="Decision">
        {approval.choices.includes("approve") ? (
          <button ref={firstButtonRef} type="button" disabled={decided} onClick={() => decide("approve")}>
            Approve once
          </button>
        ) : null}
        {rememberable && approval.choices.includes("approve") ? (
          <>
            <button type="button" disabled={decided} onClick={() => remember("session")}>
              Approve for this session
            </button>
            {canPersist ? (
              <button type="button" disabled={decided} onClick={() => remember("project")}>
                Save to this project
              </button>
            ) : null}
          </>
        ) : null}
        {approval.choices.includes("edit") ? (
          <button type="button" disabled={decided} onClick={() => decide("edit")}>
            Edit
          </button>
        ) : null}
        {approval.choices.includes("reject") ? (
          <button type="button" disabled={decided} onClick={() => decide("reject")}>
            Reject
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Keep focus inside the modal while Tab cycles (§9 focus trap). */
function trapFocus(e: React.KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = container.ownerDocument.activeElement;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * The exact-only save note, adapted by force-ask family (owner D2b) — mirrors
 * the CLI's `ConfirmationDialog` wording exactly: a web_fetch/web_search SSRF
 * lift saves for that exact host, a plugin install for that exact package
 * version, and anything else (a dangerous shell command) for that exact command.
 */
function exactOnlyNote(kind: PendingApproval["forceAskKind"], tool?: string): string {
  if (kind === "ssrf") return "Saved for this exact host only.";
  if (kind === "plugin-install") return "Saved for this exact package version only.";
  if (kind === "control-file" && (tool === "write_file" || tool === "edit_file")) {
    return "Saved for this exact file only.";
  }
  return "Saved as this exact command only.";
}
