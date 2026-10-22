/**
 * voidrift-web-client — the thin browser client (web-blueprint.md §1.3).
 *
 * Exports the components and the event/action clients. The client reaches the
 * SDK ONLY through the web-server HTTP + WebSocket surface and never imports
 * `@voidrift/core` (invariant §12.1#2).
 */
export { Shell, type ShellProps } from "./app/Shell.js";
export { Transcript, DiffView, type TranscriptProps } from "./workspace/Transcript.js";
export { SessionList, Composer, type SessionListProps, type ComposerProps } from "./workspace/SessionList.js";
export { ConfirmationDialog, type ConfirmationDialogProps } from "./approvals/ConfirmationDialog.js";
export { PanelHost, type PanelHostProps } from "./panels/PanelHost.js";
export { reduce, appendUserTurn, initialState, type ConversationState } from "./events/reducer.js";
export { StreamClient, type StreamClientOptions, type SocketLike } from "./events/stream-client.js";
export { ActionClient, type ActionClientOptions } from "./app/action-client.js";
export type {
  WireEvent,
  RelayFrame,
  SessionInfo,
  PendingApproval,
  ApprovalResponse,
  TurnResult,
  ToolRow,
  TranscriptTurn,
} from "./events/wire.js";
