/**
 * Event reducer tests (web-blueprint.md §2.1, §5.1).
 */
import { describe, it, expect } from "vitest";
import { reduce, appendUserTurn, initialState } from "./reducer.js";
import type { WireEvent } from "./wire.js";

function ev(type: string, payload: Record<string, unknown>): WireEvent {
  return { type, scope: { session: "s1" }, at: "now", payload };
}

describe("§2.1 reducer", () => {
  it("accumulates TOKEN_STREAM into one assistant turn and reconciles on TURN_COMPLETE", () => {
    let s = initialState;
    s = reduce(s, ev("TOKEN_STREAM", { token: "Hel" }));
    s = reduce(s, ev("TOKEN_STREAM", { token: "lo" }));
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0]!.text).toBe("Hello");
    s = reduce(s, ev("TURN_COMPLETE", { text: "Hello.", status: "completed" }));
    expect(s.turns[0]!.text).toBe("Hello.");
    expect(s.turns[0]!.done).toBe(true);
  });

  it("opens and closes a tool row and keeps its diff", () => {
    let s = initialState;
    s = reduce(s, ev("TOOL_STARTED", { id: "t1", name: "write", args: { path: "a.ts" } }));
    expect(s.turns[0]!.tools[0]!.status).toBe("running");
    s = reduce(s, ev("TOOL_FINISHED", { id: "t1", name: "write", status: "success", summary: "ok", diff: "+a" }));
    expect(s.turns[0]!.tools[0]!.status).toBe("success");
    expect(s.turns[0]!.tools[0]!.diff).toBe("+a");
  });

  it("marks a tool error status", () => {
    let s = reduce(initialState, ev("TOOL_STARTED", { id: "t1", name: "x", args: {} }));
    s = reduce(s, ev("TOOL_FINISHED", { id: "t1", name: "x", status: "error" }));
    expect(s.turns[0]!.tools[0]!.status).toBe("error");
  });

  it("moves the context meter verbatim and never recomputes", () => {
    const s = reduce(initialState, ev("CONTEXT_BUDGET_UPDATED", { percentage: 42 }));
    expect(s.contextPercentage).toBe(42);
  });

  it("raises a pending approval and clears it on resolve", () => {
    let s = reduce(initialState, ev("PERMISSION_REQUESTED", { requestId: "r1", tool: "write", args: { path: "x" }, diff: "+x" }));
    expect(s.pending?.id).toBe("r1");
    expect(s.pending?.diff).toBe("+x");
    s = reduce(s, ev("PERMISSION_RESOLVED", {}));
    expect(s.pending).toBeNull();
  });

  it("carries `rememberable: true` from the raw event into the pending approval", () => {
    const s = reduce(
      initialState,
      ev("PERMISSION_REQUESTED", {
        requestId: "r1",
        tool: "execute_command",
        args: { command: "ls" },
        rememberable: true,
        inferredPatterns: ["ls *"],
      }),
    );
    expect(s.pending?.rememberable).toBe(true);
    expect(s.pending?.inferredPatterns).toEqual(["ls *"]);
  });

  it("carries `rememberable: false` through (force-ask stays NOT rememberable)", () => {
    const s = reduce(
      initialState,
      ev("PERMISSION_REQUESTED", { requestId: "r2", tool: "execute_command", args: { command: "rm -rf /" }, rememberable: false }),
    );
    expect(s.pending?.rememberable).toBe(false);
  });

  it("leaves `rememberable` absent when the event omits it (dialog fails closed)", () => {
    const s = reduce(initialState, ev("PERMISSION_REQUESTED", { requestId: "r3", tool: "t", args: {} }));
    expect(s.pending).not.toBeNull();
    expect("rememberable" in (s.pending as object)).toBe(false);
  });

  it("carries `exactOnly: true` and `forceAskKind` from the raw event (owner D2b)", () => {
    const s = reduce(
      initialState,
      ev("PERMISSION_REQUESTED", {
        requestId: "r6",
        tool: "execute_command",
        args: { command: "rm -rf x" },
        rememberable: true,
        exactOnly: true,
        forceAskKind: "shell",
        inferredPatterns: ["rm -rf x"],
      }),
    );
    expect(s.pending?.exactOnly).toBe(true);
    expect(s.pending?.forceAskKind).toBe("shell");
  });

  it("omits `exactOnly`/`forceAskKind` when absent or not a known tag (fails closed)", () => {
    const missing = reduce(initialState, ev("PERMISSION_REQUESTED", { requestId: "r7", tool: "t", args: {} }));
    expect("exactOnly" in (missing.pending as object)).toBe(false);
    expect("forceAskKind" in (missing.pending as object)).toBe(false);
    const bogus = reduce(
      initialState,
      ev("PERMISSION_REQUESTED", { requestId: "r8", tool: "t", args: {}, exactOnly: "yes", forceAskKind: "nope" }),
    );
    expect("exactOnly" in (bogus.pending as object)).toBe(false);
    expect("forceAskKind" in (bogus.pending as object)).toBe(false);
  });

  it("honors a core-sent `choices` array and defaults it when absent", () => {
    const withChoices = reduce(initialState, ev("PERMISSION_REQUESTED", { requestId: "r4", tool: "t", args: {}, choices: ["approve", "reject"] }));
    expect(withChoices.pending?.choices).toEqual(["approve", "reject"]);
    const noChoices = reduce(initialState, ev("PERMISSION_REQUESTED", { requestId: "r5", tool: "t", args: {} }));
    expect(noChoices.pending?.choices).toEqual(["approve", "edit", "reject"]);
  });

  it("accumulates reasoning separately and surfaces errors", () => {
    let s = reduce(initialState, ev("REASONING_STREAM", { token: "think" }));
    expect(s.turns[0]!.reasoning).toBe("think");
    s = reduce(s, ev("ERROR_OCCURRED", { message: "boom" }));
    expect(s.error).toBe("boom");
  });

  it("appends a user turn and ignores unknown events", () => {
    let s = appendUserTurn(initialState, "u1", "hi");
    expect(s.turns[0]!.role).toBe("user");
    const before = s;
    s = reduce(s, ev("UNKNOWN", {}));
    expect(s).toBe(before);
  });

  it("closes an open assistant turn on TURN_CANCELLED", () => {
    let s = reduce(initialState, ev("TOKEN_STREAM", { token: "x" }));
    s = reduce(s, ev("TURN_CANCELLED", {}));
    expect(s.turns[0]!.done).toBe(true);
  });
});
