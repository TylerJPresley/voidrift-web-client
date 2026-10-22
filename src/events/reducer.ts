/**
 * The scoped-event reducer (web-blueprint.md §2.1, §5.1).
 *
 * Turns each relayed `WireEvent` into view state exactly as the CLI/VS Code
 * handlers do (CLI §1.4): TOKEN_STREAM accumulates assistant text,
 * TOOL_STARTED/TOOL_FINISHED open and close tool rows, REASONING_STREAM fills
 * the collapsed reasoning view, CONTEXT_BUDGET_UPDATED moves the occupancy
 * meter, PERMISSION_REQUESTED raises an approval. The browser computes nothing
 * the core owns — it reflects events (invariant §12.1#1). The reducer is pure.
 */
import type { WireEvent, TranscriptTurn, ToolRow, PendingApproval } from "./wire.js";

export interface ConversationState {
  readonly turns: TranscriptTurn[];
  /** Context occupancy percentage read verbatim from CONTEXT_BUDGET_UPDATED. */
  readonly contextPercentage: number;
  /** The active pending approval, if any (PERMISSION_REQUESTED, core §9.5). */
  readonly pending: PendingApproval | null;
  /** The last error surfaced for an assertive live-region announcement. */
  readonly error: string | null;
}

export const initialState: ConversationState = {
  turns: [],
  contextPercentage: 0,
  pending: null,
  error: null,
};

/** Append a user turn to the transcript when the browser submits input. */
export function appendUserTurn(state: ConversationState, id: string, text: string): ConversationState {
  const turn: TranscriptTurn = { id, role: "user", text, reasoning: "", tools: [], done: true };
  return { ...state, turns: [...state.turns, turn] };
}

/** Ensure an open assistant turn exists to accumulate streamed output into. */
function openAssistant(turns: TranscriptTurn[]): { turns: TranscriptTurn[]; active: TranscriptTurn } {
  const last = turns[turns.length - 1];
  if (last && last.role === "assistant" && !last.done) {
    return { turns, active: last };
  }
  const active: TranscriptTurn = {
    id: `a-${turns.length}`,
    role: "assistant",
    text: "",
    reasoning: "",
    tools: [],
    done: false,
  };
  return { turns: [...turns, active], active };
}

function str(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  return typeof v === "string" ? v : "";
}

/** True when the value is one of the core's force-ask family tags. */
function isForceAskKind(v: unknown): v is "shell" | "ssrf" | "plugin-install" | "control-file" {
  return v === "shell" || v === "ssrf" || v === "plugin-install" || v === "control-file";
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  return Object.entries(args as Record<string, unknown>)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ")
    .slice(0, 200);
}

/** Reduce one relayed event into new view state (pure). */
export function reduce(state: ConversationState, event: WireEvent): ConversationState {
  const p = event.payload;
  switch (event.type) {
    case "TOKEN_STREAM": {
      const { turns, active } = openAssistant(state.turns);
      const updated: TranscriptTurn = { ...active, text: active.text + str(p, "token") };
      return { ...state, turns: replace(turns, updated) };
    }
    case "REASONING_STREAM": {
      const { turns, active } = openAssistant(state.turns);
      const updated: TranscriptTurn = { ...active, reasoning: active.reasoning + str(p, "token") };
      return { ...state, turns: replace(turns, updated) };
    }
    case "TOOL_STARTED": {
      const { turns, active } = openAssistant(state.turns);
      const row: ToolRow = {
        id: str(p, "id"),
        name: str(p, "name"),
        argsSummary: summarizeArgs(p["args"]),
        status: "running",
      };
      const updated: TranscriptTurn = { ...active, tools: [...active.tools, row] };
      return { ...state, turns: replace(turns, updated) };
    }
    case "TOOL_FINISHED": {
      const { turns, active } = openAssistant(state.turns);
      const id = str(p, "id");
      const status: ToolRow["status"] = str(p, "status") === "error" ? "error" : "success";
      const tools = active.tools.map((t) =>
        t.id === id
          ? { ...t, status, summary: str(p, "summary"), ...(typeof p["diff"] === "string" ? { diff: p["diff"] } : {}) }
          : t,
      );
      return { ...state, turns: replace(turns, { ...active, tools }) };
    }
    case "TURN_COMPLETE": {
      // Reconcile the assistant text to the authoritative TurnResult.text (§2.2).
      const { turns, active } = openAssistant(state.turns);
      const text = str(p, "text") || active.text;
      return { ...state, turns: replace(turns, { ...active, text, done: true }), pending: null };
    }
    case "TURN_CANCELLED": {
      const last = state.turns[state.turns.length - 1];
      if (last && last.role === "assistant" && !last.done) {
        return { ...state, turns: replace(state.turns, { ...last, done: true }) };
      }
      return state;
    }
    case "CONTEXT_BUDGET_UPDATED": {
      const v = p["percentage"];
      return { ...state, contextPercentage: typeof v === "number" ? v : state.contextPercentage };
    }
    case "PERMISSION_REQUESTED": {
      // Copy every field the ConfirmationDialog reads from the raw event. In
      // particular `rememberable` MUST be carried through: a `true` enables the
      // four-choice set (session/project). `exactOnly` and `forceAskKind` ride
      // alongside a rememberable force-ask so the dialog can show the exact-only
      // note (owner D2b). Only a literal boolean is copied for the booleans — an
      // absent/non-boolean value is left off and the dialog fails closed (treats
      // it as NOT rememberable / NOT exact-only). `choices` is honored when the
      // core sends it.
      const pending: PendingApproval = {
        id: str(p, "requestId"),
        tool: str(p, "tool"),
        args: (p["args"] as Record<string, unknown>) ?? {},
        choices: Array.isArray(p["choices"]) ? (p["choices"] as PendingApproval["choices"]) : ["approve", "edit", "reject"],
        mode: "out_of_band",
        ...(typeof p["workerId"] === "string" ? { workerId: p["workerId"] } : {}),
        ...(Array.isArray(p["inferredPatterns"]) ? { inferredPatterns: p["inferredPatterns"] as string[] } : {}),
        ...(typeof p["rememberable"] === "boolean" ? { rememberable: p["rememberable"] } : {}),
        ...(typeof p["exactOnly"] === "boolean" ? { exactOnly: p["exactOnly"] } : {}),
        ...(isForceAskKind(p["forceAskKind"]) ? { forceAskKind: p["forceAskKind"] } : {}),
        ...(typeof p["diff"] === "string" ? { diff: p["diff"] } : {}),
      };
      return { ...state, pending };
    }
    case "PERMISSION_RESOLVED":
      return { ...state, pending: null };
    case "ERROR_OCCURRED":
    case "CONTEXT_OVERFLOW":
      return { ...state, error: str(p, "message") };
    default:
      return state;
  }
}

function replace(turns: TranscriptTurn[], turn: TranscriptTurn): TranscriptTurn[] {
  const idx = turns.findIndex((t) => t.id === turn.id);
  if (idx === -1) return [...turns, turn];
  const copy = turns.slice();
  copy[idx] = turn;
  return copy;
}
