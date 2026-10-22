/**
 * Stream + action client tests (web-blueprint.md §2.1, §3).
 */
import { describe, it, expect } from "vitest";
import { StreamClient, type SocketLike } from "./stream-client.js";
import type { RelayFrame } from "./wire.js";

class FakeSocket implements SocketLike {
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: { data?: unknown }) => void>> = {};
  send(d: string): void {
    this.sent.push(d);
  }
  close(): void {
    this.emit("close", {});
  }
  addEventListener(type: string, listener: (ev: { data?: unknown }) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string, ev: { data?: unknown }): void {
    for (const l of this.listeners[type] ?? []) l(ev);
  }
}

describe("§3 StreamClient", () => {
  it("subscribes on open, relays frames, routes errors, and unsubscribes", () => {
    const socket = new FakeSocket();
    const frames: RelayFrame[] = [];
    const errors: string[] = [];
    const client = new StreamClient({
      url: "wss://x/api/stream?token=t",
      connect: () => socket,
      onFrame: (f) => frames.push(f),
      onError: (r) => errors.push(r),
    });
    client.connect();
    client.subscribe("s1");
    socket.emit("open", {});
    expect(socket.sent.filter((s) => s.includes("subscribe")).length).toBeGreaterThan(0);

    socket.emit("message", { data: JSON.stringify({ sessionId: "s1", event: { type: "TOKEN_STREAM", scope: {}, at: "", payload: {} } }) });
    expect(frames).toHaveLength(1);

    socket.emit("message", { data: JSON.stringify({ kind: "error", reason: "forbidden" }) });
    expect(errors).toEqual(["forbidden"]);

    socket.emit("message", { data: "{bad json" });
    expect(frames).toHaveLength(1);

    client.unsubscribe("s1");
    expect(socket.sent.some((s) => s.includes("unsubscribe"))).toBe(true);
    client.close();
  });

  it("uses the default WebSocket factory path without throwing when not connected", () => {
    const client = new StreamClient({ url: "wss://x", onFrame: () => undefined });
    expect(() => client.unsubscribe("none")).not.toThrow();
    expect(() => client.close()).not.toThrow();
  });
});
