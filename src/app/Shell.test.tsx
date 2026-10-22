/**
 * Shell composition test (web-blueprint.md §8, §9).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shell } from "./Shell.js";
import { initialState, reduce, appendUserTurn } from "../events/reducer.js";
import type { WireEvent } from "../events/wire.js";

const sessions = [{ id: "s1", name: "one", summary: "", lastActiveAt: "", sizeBytes: 0, workspace: "" }];

function ev(type: string, payload: Record<string, unknown>): WireEvent {
  return { type, scope: { session: "s1" }, at: "", payload };
}

describe("§8 Shell", () => {
  it("renders nav/main landmarks and the composer", () => {
    render(
      <Shell
        sessions={sessions}
        activeId="s1"
        state={appendUserTurn(initialState, "u1", "hi")}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onSend={vi.fn()}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Message composer" })).toBeInTheDocument();
  });

  it("raises the approval dialog and disables the composer while pending", () => {
    const state = reduce(initialState, ev("PERMISSION_REQUESTED", { requestId: "r1", tool: "write", args: {} }));
    render(
      <Shell sessions={sessions} activeId="s1" state={state} onSelect={vi.fn()} onNew={vi.fn()} onSend={vi.fn()} onDecision={vi.fn()} />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("surfaces an error through an assertive alert", () => {
    const state = reduce(initialState, ev("ERROR_OCCURRED", { message: "boom" }));
    render(
      <Shell sessions={sessions} activeId="s1" state={state} onSelect={vi.fn()} onNew={vi.fn()} onSend={vi.fn()} onDecision={vi.fn()} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("boom");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });
});
