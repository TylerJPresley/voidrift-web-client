/**
 * Component accessibility tests (web-blueprint.md §8, §9).
 * Verifies accessible roles, the polite/assertive live regions, keyboard
 * operation, focus management, and semantic structure.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Transcript } from "../workspace/Transcript.js";
import { ConfirmationDialog } from "../approvals/ConfirmationDialog.js";
import { PanelHost } from "../panels/PanelHost.js";
import { Composer, SessionList } from "../workspace/SessionList.js";
import type { TranscriptTurn, PendingApproval, WirePanelDeclaration, WireEvent } from "../events/wire.js";
import { reduce, initialState } from "../events/reducer.js";
import builtinPanels from "../panels/fixtures/builtin-panels.json" with { type: "json" };

describe("§9 Transcript", () => {
  const turns: TranscriptTurn[] = [
    { id: "u1", role: "user", text: "hi", reasoning: "", tools: [], done: true },
    {
      id: "a1",
      role: "assistant",
      text: "hello",
      reasoning: "thought",
      tools: [{ id: "t1", name: "write", argsSummary: "path=a.ts", status: "success", summary: "ok", diff: "+a\n-b\n c" }],
      done: true,
    },
  ];

  it("renders a labeled polite log region with turn articles", () => {
    render(<Transcript turns={turns} contextPercentage={30} />);
    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("progressbar", { name: "Context occupancy" })).toHaveAttribute("aria-valuenow", "30");
  });

  it("renders a diff with per-line +/- markers (color not sole carrier)", () => {
    render(<Transcript turns={turns} contextPercentage={0} />);
    const diff = screen.getByLabelText("diff");
    expect(within(diff).getByText("+a")).toHaveAttribute("data-diff", "added");
    expect(within(diff).getByText("-b")).toHaveAttribute("data-diff", "removed");
  });

  it("toggles the reasoning disclosure", () => {
    render(<Transcript turns={turns} contextPercentage={0} />);
    const summary = screen.getByText("Reasoning");
    fireEvent.click(summary);
    expect(screen.getByText("thought")).toBeInTheDocument();
  });

  it("strips Unicode bidi/zero-width controls from external text (Trojan Source)", () => {
    // Given — assistant text, tool arg, summary, and diff carrying bidi overrides
    // (U+202E RLO), directional marks, and zero-width spoofing characters.
    const hostile: TranscriptTurn[] = [
      {
        id: "x",
        role: "assistant",
        text: "safe\u202eevil\u2066x\u2069\u200btail",
        reasoning: "r\u202eq",
        tools: [{ id: "t", name: "write", argsSummary: "p\u202ea", status: "success", summary: "o\u200bk", diff: "+a\u202eb" }],
        done: true,
      },
    ];
    render(<Transcript turns={hostile} contextPercentage={0} />);
    // When / Then — no forbidden code point survives in any rendered text node.
    const forbidden = /[\u202a-\u202e\u2066-\u2069\u200b\u200c\u200e\u200f\u2060\ufeff]/;
    for (const node of document.querySelectorAll("p, span, pre, div")) {
      expect(node.textContent ?? "").not.toMatch(forbidden);
    }
    // The visible ASCII content is preserved (only controls removed).
    expect(screen.getByText(/safeevilxtail/)).toBeInTheDocument();
  });

  it("keeps ZWJ so emoji sequences still render", () => {
    const emoji: TranscriptTurn[] = [
      { id: "e", role: "assistant", text: "👨\u200d👩\u200d👧 🇺🇸", reasoning: "", tools: [], done: true },
    ];
    render(<Transcript turns={emoji} contextPercentage={0} />);
    expect(screen.getByText("👨\u200d👩\u200d👧 🇺🇸")).toBeInTheDocument();
  });
});

describe("§6/§9 ConfirmationDialog", () => {
  const approval: PendingApproval = {
    id: "r1",
    tool: "write_file",
    args: { path: "secret.ts", token: "****" },
    choices: ["approve", "edit", "reject"],
    mode: "out_of_band",
    rememberable: true,
    inferredPatterns: ["write_file:*.ts"],
    diff: "+added\n-removed",
  };

  it("is an assertive focus-trapped alertdialog showing the full masked action", () => {
    const onDecision = vi.fn();
    render(<ConfirmationDialog approval={approval} onDecision={onDecision} />);
    const dialog = screen.getByRole("alertdialog", { name: /Approve action: write_file/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-live", "assertive");
    // The masked value is rendered verbatim, never un-masked.
    expect(screen.getByText(/"token": "\*\*\*\*"/)).toBeInTheDocument();
    // First actionable button (Approve once) receives focus.
    expect(screen.getByRole("button", { name: "Approve once" })).toHaveFocus();
  });

  it("renders the four choices with the fixed wording", () => {
    render(<ConfirmationDialog approval={approval} onDecision={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Approve once" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve for this session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to this project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("the four choices map to the right responses", () => {
    // The dialog latches after the first decision, so each choice is exercised
    // on its own freshly-rendered instance (mirroring real use: the parent
    // unmounts the dialog once a decision is made).
    const once = vi.fn();
    const { unmount: u1 } = render(<ConfirmationDialog approval={approval} onDecision={once} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));
    expect(once).toHaveBeenCalledWith({ requestId: "r1", decision: "approve" });
    u1();

    const session = vi.fn();
    const { unmount: u2 } = render(<ConfirmationDialog approval={approval} onDecision={session} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve for this session" }));
    expect(session).toHaveBeenCalledWith({ requestId: "r1", decision: "approve", remember: "session", chosenPattern: "write_file:*.ts" });
    u2();

    const project = vi.fn();
    const { unmount: u3 } = render(<ConfirmationDialog approval={approval} onDecision={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Save to this project" }));
    expect(project).toHaveBeenCalledWith({ requestId: "r1", decision: "approve", remember: "project", chosenPattern: "write_file:*.ts" });
    u3();

    const reject = vi.fn();
    render(<ConfirmationDialog approval={approval} onDecision={reject} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(reject).toHaveBeenCalledWith({ requestId: "r1", decision: "reject" });
  });

  it("shows the project config target and the exact tool + pattern that will be saved", () => {
    render(<ConfirmationDialog approval={approval} onDecision={vi.fn()} />);
    const fieldset = screen.getByRole("group", { name: "Save to this project" });
    expect(within(fieldset).getByText(".voidrift/config.json")).toBeInTheDocument();
    expect(within(fieldset).getByText("write_file")).toBeInTheDocument();
    expect(within(fieldset).getByText("write_file:*.ts")).toBeInTheDocument();
  });

  it("offers a labelled radio group to pick among several patterns; sends the chosen one", () => {
    const onDecision = vi.fn();
    const multi = { ...approval, inferredPatterns: ["write_file:*.ts", "write_file:*.js"] };
    render(<ConfirmationDialog approval={multi} onDecision={onDecision} />);
    const group = screen.getByRole("radiogroup", { name: "Pattern to save" });
    fireEvent.click(within(group).getByRole("radio", { name: /write_file:\*\.js/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save to this project" }));
    expect(onDecision).toHaveBeenLastCalledWith({ requestId: "r1", decision: "approve", remember: "project", chosenPattern: "write_file:*.js" });
  });

  it("non-rememberable renders ONLY approve-once and reject with the always-asked note", () => {
    const forceAsk: PendingApproval = { ...approval, rememberable: false };
    render(<ConfirmationDialog approval={forceAsk} onDecision={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Approve once" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for this session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save to this project" })).toBeNull();
    expect(screen.getByText("This kind of action is always asked.")).toBeInTheDocument();
  });

  it("fails closed when rememberable is missing (treated as not rememberable)", () => {
    const noFlag: PendingApproval = { id: "r9", tool: "t", args: {}, choices: ["approve", "reject"], mode: "out_of_band", inferredPatterns: ["t:x"] };
    render(<ConfirmationDialog approval={noFlag} onDecision={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Approve for this session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save to this project" })).toBeNull();
    expect(screen.getByText("This kind of action is always asked.")).toBeInTheDocument();
  });

  it("shows the exact-only note next to the save preview, by force-ask family (owner D2b)", () => {
    const shell: PendingApproval = { ...approval, exactOnly: true, forceAskKind: "shell" };
    const { unmount: u1 } = render(<ConfirmationDialog approval={shell} onDecision={vi.fn()} />);
    const fieldset = screen.getByRole("group", { name: "Save to this project" });
    expect(within(fieldset).getByText("Saved as this exact command only.")).toBeInTheDocument();
    u1();

    const host: PendingApproval = { ...approval, tool: "web_fetch", exactOnly: true, forceAskKind: "ssrf", inferredPatterns: ["example.com"] };
    const { unmount: u2 } = render(<ConfirmationDialog approval={host} onDecision={vi.fn()} />);
    expect(screen.getByText("Saved for this exact host only.")).toBeInTheDocument();
    u2();

    const pkg: PendingApproval = { ...approval, tool: "plugins_install", exactOnly: true, forceAskKind: "plugin-install", inferredPatterns: ["pkg@1.2.3"] };
    render(<ConfirmationDialog approval={pkg} onDecision={vi.fn()} />);
    expect(screen.getByText("Saved for this exact package version only.")).toBeInTheDocument();
  });

  it("control-file note follows the tool: FILE for a file tool, COMMAND for a shell tool (owner S1)", () => {
    const file: PendingApproval = {
      ...approval,
      tool: "write_file",
      exactOnly: true,
      forceAskKind: "control-file",
      inferredPatterns: ["AGENTS.md"],
    };
    const { unmount: u1 } = render(<ConfirmationDialog approval={file} onDecision={vi.fn()} />);
    expect(screen.getByText("Saved for this exact file only.")).toBeInTheDocument();
    u1();

    const cmd: PendingApproval = {
      ...approval,
      tool: "execute_command",
      exactOnly: true,
      forceAskKind: "control-file",
      inferredPatterns: ["echo x > .git/hooks/pre-commit"],
    };
    render(<ConfirmationDialog approval={cmd} onDecision={vi.fn()} />);
    expect(screen.getByText("Saved as this exact command only.")).toBeInTheDocument();
  });

  it("does not show the exact-only note when exactOnly is absent", () => {
    render(<ConfirmationDialog approval={approval} onDecision={vi.fn()} />);
    expect(screen.queryByText(/Saved (as|for) this exact/)).toBeNull();
  });

  it("rejects on Escape", () => {
    const onDecision = vi.fn();
    render(<ConfirmationDialog approval={approval} onDecision={onDecision} />);
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: "reject" }));
  });

  it("fires edit and reject button decisions and traps Tab focus", () => {
    const editFn = vi.fn();
    const { unmount } = render(<ConfirmationDialog approval={approval} onDecision={editFn} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(editFn).toHaveBeenLastCalledWith(expect.objectContaining({ decision: "edit" }));
    unmount();

    const rejectFn = vi.fn();
    render(<ConfirmationDialog approval={approval} onDecision={rejectFn} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(rejectFn).toHaveBeenLastCalledWith(expect.objectContaining({ decision: "reject" }));
    // Tab/Shift+Tab on the dialog exercise the focus trap without throwing.
    const dialog = screen.getByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Tab" });
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  });

  it("restores focus to the trigger on unmount", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const ref = { current: trigger };
    const onDecision = vi.fn();
    const { unmount } = render(<ConfirmationDialog approval={approval} onDecision={onDecision} returnFocusRef={ref} />);
    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it("renders no 'Save to this project' when no inferred patterns", () => {
    const noPatterns = { ...approval, inferredPatterns: [] };
    render(<ConfirmationDialog approval={noPatterns} onDecision={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Save to this project" })).toBeNull();
    // A rememberable ask with no pattern can still remember a session decision.
    expect(screen.getByRole("button", { name: "Approve for this session" })).toBeInTheDocument();
  });

  it("latches: a rapid double-click sends exactly ONE decision and disables the buttons", () => {
    const onDecision = vi.fn();
    render(<ConfirmationDialog approval={approval} onDecision={onDecision} />);
    const approveOnce = screen.getByRole("button", { name: "Approve once" });
    fireEvent.click(approveOnce);
    fireEvent.click(approveOnce);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith({ requestId: "r1", decision: "approve" });
    // Every button is disabled after the first decision.
    expect(approveOnce).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("latches: Escape then a button click still sends exactly ONE decision", () => {
    const onDecision = vi.fn();
    render(<ConfirmationDialog approval={approval} onDecision={onDecision} />);
    const dialog = screen.getByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith({ requestId: "r1", decision: "reject" });
  });
});

describe("§2.1→§9 wire path: raw event → reducer → rendered choices", () => {
  // A core-shaped PERMISSION_REQUESTED event, reduced to pending state, then
  // rendered through the real dialog. This end-to-end path is what broke when
  // the reducer dropped `rememberable`; it guards the whole chain.
  const requested = (payload: Record<string, unknown>): WireEvent => ({
    type: "PERMISSION_REQUESTED",
    scope: { session: "s1" },
    at: "now",
    payload,
  });

  it("rememberable: true ⇒ FOUR buttons rendered", () => {
    const s = reduce(initialState, requested({
      requestId: "r1",
      tool: "execute_command",
      args: { command: "ls" },
      choices: ["approve", "edit", "reject"],
      rememberable: true,
      inferredPatterns: ["ls *"],
    }));
    expect(s.pending).not.toBeNull();
    render(<ConfirmationDialog approval={s.pending!} onDecision={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Approve once" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve for this session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to this project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("rememberable: false ⇒ only approve-once + reject", () => {
    const s = reduce(initialState, requested({
      requestId: "r2",
      tool: "execute_command",
      args: { command: "rm -rf /" },
      choices: ["approve", "reject"],
      rememberable: false,
    }));
    render(<ConfirmationDialog approval={s.pending!} onDecision={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Approve once" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for this session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save to this project" })).toBeNull();
  });

  it("rememberable MISSING ⇒ fails closed to two buttons", () => {
    const s = reduce(initialState, requested({ requestId: "r3", tool: "t", args: {}, choices: ["approve", "reject"] }));
    render(<ConfirmationDialog approval={s.pending!} onDecision={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Approve for this session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save to this project" })).toBeNull();
    expect(screen.getByText("This kind of action is always asked.")).toBeInTheDocument();
  });

  it("exactOnly:true ⇒ the exact-only note renders through the real wire path (owner D2b)", () => {
    const s = reduce(initialState, requested({
      requestId: "r4",
      tool: "execute_command",
      args: { command: "rm -rf x" },
      choices: ["approve", "reject"],
      rememberable: true,
      exactOnly: true,
      forceAskKind: "shell",
      inferredPatterns: ["rm -rf x"],
    }));
    expect(s.pending?.exactOnly).toBe(true);
    render(<ConfirmationDialog approval={s.pending!} onDecision={vi.fn()} />);
    expect(screen.getByText("Saved as this exact command only.")).toBeInTheDocument();
  });
});

describe("§5.3 PanelHost", () => {
  const def: WirePanelDeclaration = {
    title: "Sessions",
    columns: [
      { key: "name", label: "Name" },
      { key: "id", label: "Id" },
    ],
    source: "sessions",
    actions: { d: { label: "delete", op: "session.delete" } },
  };

  it("renders a semantic labeled table with action buttons from a pure-data declaration + rows", () => {
    const onAction = vi.fn();
    render(
      <PanelHost
        name="sessions"
        definition={def}
        rows={[{ name: "alpha", id: "s1" }]}
        onClose={() => undefined}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "alpha" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete/ }));
    expect(onAction).toHaveBeenCalledWith("d", { name: "alpha", id: "s1" });
  });

  it("renders every committed built-in declaration through the local wire type (§5.3 drift guard)", () => {
    // The committed fixture is the real built-in declarations relayed as JSON.
    // Rendering each through the browser's local type proves the type matches the
    // core's shape; the server-side round-trip test fails if the core drifts.
    const fixture = builtinPanels as Record<string, WirePanelDeclaration>;
    for (const [name, declaration] of Object.entries(fixture)) {
      // One synthetic row so per-row action buttons render for the hotkey check.
      const row = Object.fromEntries(declaration.columns.map((c) => [c.key, "x"]));
      const { unmount } = render(<PanelHost name={name} definition={declaration} rows={[row]} onClose={() => undefined} />);
      // The title renders, every column header appears, and each hotkey is listed.
      expect(screen.getByRole("dialog", { name: declaration.title })).toBeInTheDocument();
      for (const col of declaration.columns) {
        expect(screen.getByRole("columnheader", { name: col.label })).toBeInTheDocument();
      }
      for (const [hotkey, action] of Object.entries(declaration.actions ?? {})) {
        expect(screen.getByRole("button", { name: new RegExp(`${action.label} \\(${hotkey}\\)`) })).toBeInTheDocument();
      }
      unmount();
    }
  });
});

describe("§9 Composer + SessionList", () => {
  it("submits trimmed input and clears, operable by keyboard form", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "  hello  " } });
    fireEvent.submit(screen.getByRole("form", { name: "Message composer" }));
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("marks the active conversation with aria-current and fires select/new", () => {
    const onSelect = vi.fn();
    const onNew = vi.fn();
    render(
      <SessionList
        sessions={[{ id: "s1", name: "one", summary: "", lastActiveAt: "", sizeBytes: 0, workspace: "" }]}
        activeId="s1"
        onSelect={onSelect}
        onNew={onNew}
      />,
    );
    expect(screen.getByRole("button", { name: "one" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "one" }));
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(onSelect).toHaveBeenCalledWith("s1");
    expect(onNew).toHaveBeenCalled();
  });
});
