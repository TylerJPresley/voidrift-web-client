/**
 * The browser WebSocket client (web-blueprint.md §3).
 *
 * Opens one `wss` connection (authenticated via a short-lived token query, §4.1),
 * subscribes to the sessions the browser has open, and dispatches each relay
 * frame to the caller. The principal is established at the upgrade and never
 * re-sent per message (§3.1). A dropped connection loses no state: the caller
 * reconnects and repaints from `loadMessages` + resume (§3.3).
 */
import type { RelayFrame } from "./wire.js";

/** The minimal WebSocket surface the client drives (satisfied by the browser
 * `WebSocket` and by `ws` in tests). */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "message" | "open" | "close",
    listener: (ev: { data?: unknown }) => void,
  ): void;
}

export interface StreamClientOptions {
  /** The `wss` endpoint plus the auth token query (§4.1). */
  readonly url: string;
  /** The socket factory; defaults to the global browser WebSocket. */
  readonly connect?: (url: string) => SocketLike;
  readonly onFrame: (frame: RelayFrame) => void;
  readonly onError?: (reason: string) => void;
}

export class StreamClient {
  private socket: SocketLike | null = null;
  private readonly open = new Set<string>();

  constructor(private readonly opts: StreamClientOptions) {}

  /** Connect and resubscribe to every open session on open (§3.3 reconnect). */
  connect(): void {
    const factory = this.opts.connect ?? ((u: string) => new WebSocket(u));
    const socket = factory(this.opts.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      for (const id of this.open) this.sendSubscribe(id);
    });
    socket.addEventListener("message", (ev) => this.onMessage(ev.data));
    socket.addEventListener("close", () => {
      this.socket = null;
    });
  }

  private onMessage(data: unknown): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(data));
    } catch {
      return;
    }
    if (isRelayFrame(parsed)) {
      this.opts.onFrame(parsed);
      return;
    }
    if (isErrorFrame(parsed)) this.opts.onError?.(parsed.reason);
  }

  subscribe(sessionId: string): void {
    this.open.add(sessionId);
    this.sendSubscribe(sessionId);
  }

  unsubscribe(sessionId: string): void {
    this.open.delete(sessionId);
    this.socket?.send(JSON.stringify({ kind: "unsubscribe", sessionId }));
  }

  private sendSubscribe(sessionId: string): void {
    this.socket?.send(JSON.stringify({ kind: "subscribe", sessionId }));
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.open.clear();
  }
}

function isRelayFrame(v: unknown): v is RelayFrame {
  return typeof v === "object" && v !== null && "sessionId" in v && "event" in v;
}

function isErrorFrame(v: unknown): v is { kind: "error"; reason: string } {
  return typeof v === "object" && v !== null && (v as { kind?: string }).kind === "error";
}
