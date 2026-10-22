/**
 * Wire types the thin client reads (web-blueprint.md §1.1, §2).
 *
 * The browser holds VIEW state only and derives everything from events and DTOs
 * the backend relays (§1.1). These types mirror the shapes the server sends over
 * HTTP and the WebSocket; they are declared HERE, in the client, so the client
 * NEVER imports `@voidrift/core` (invariant §12.1#2) — it reaches the SDK only
 * through the server's HTTP + WebSocket surface.
 */

/** A relayed event envelope — the scoped event the server forwards (§2.1, §3.1). */
export interface WireEvent {
  readonly type: string;
  readonly scope: { workspace?: string; session?: string; worker?: string };
  readonly at: string;
  readonly payload: Record<string, unknown>;
}

/** A server → browser relay frame carrying exactly one session's event (§3.1). */
export interface RelayFrame {
  readonly sessionId: string;
  readonly event: WireEvent;
}

/** Session metadata the server lists/returns (SessionInfo DTO, core §2.4). */
export interface SessionInfo {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly lastActiveAt: string;
  readonly sizeBytes: number;
  readonly workspace: string;
}

/** A pending approval the server relays verbatim, already masked by the core
 * (core §9.5, §10.10). The browser renders it; it never reconstructs a value. */
export interface PendingApproval {
  readonly id: string;
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly workerId?: string;
  readonly choices: ReadonlyArray<"approve" | "edit" | "reject">;
  readonly mode: "interactive" | "policy_only" | "out_of_band";
  readonly inferredPatterns?: string[];
  readonly rememberable?: boolean;
  /** owner D2a — an exact-only remember (force-ask lift). Explanatory flag; the
   * D2b web UI renders the exact-only note. Carried through for parity. */
  readonly exactOnly?: boolean;
  /** The force-ask family (core §9.5) when this ask is a force-ask: `"shell"`,
   * `"ssrf"`, or `"plugin-install"`. The D2b web UI uses it to pick the
   * exact-only note wording (command / host / package version). */
  readonly forceAskKind?: "shell" | "ssrf" | "plugin-install" | "control-file";
  readonly diff?: string;
}

/** The browser's decision posted back as `session.confirm` (core §9.5). */
export interface ApprovalResponse {
  readonly requestId: string;
  readonly decision: "approve" | "edit" | "reject";
  readonly editedArgs?: Record<string, unknown>;
  readonly remember?: "session" | "project";
  readonly chosenPattern?: string;
}

/** The terminal/non-terminal TurnResult the send/confirm response carries. */
export interface TurnResult {
  readonly status: string;
  readonly text?: string;
  readonly pending?: PendingApproval[];
}

/** A rendered tool row in the transcript (TOOL_STARTED/TOOL_FINISHED, core §8.1). */
export interface ToolRow {
  readonly id: string;
  readonly name: string;
  readonly argsSummary: string;
  status: "running" | "success" | "error";
  summary?: string;
  diff?: string;
}

/** A rendered conversation turn — the transcript article the a11y log holds. */
export interface TranscriptTurn {
  readonly id: string;
  role: "user" | "assistant";
  text: string;
  reasoning: string;
  tools: ToolRow[];
  done: boolean;
}

/**
 * A panel declaration as it arrives over the wire — a LOCAL structural mirror of
 * the core's `PanelDeclaration` (core §12.6, panels §5). The browser must never
 * import `@voidrift/core`, so it keeps this copy and renders the JSON the server
 * relays unchanged. A committed fixture of the real built-in declarations and a
 * test that renders it catch any drift between this type and the core's shape
 * (web-blueprint §5.3, panels §5).
 */
export interface WirePanelColumn {
  readonly key: string;
  readonly label: string;
  readonly width?: number;
}

export interface WirePanelAction {
  readonly label: string;
  readonly op: string;
}

export interface WirePanelDeclaration {
  readonly title: string;
  readonly columns: readonly WirePanelColumn[];
  readonly source: string | readonly string[];
  readonly actions?: Readonly<Record<string, WirePanelAction>>;
}
