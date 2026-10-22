/**
 * ActionClient tests (web-blueprint.md §2.1).
 * Each action is exactly one HTTP call carrying the bearer token.
 */
import { describe, it, expect } from "vitest";
import { ActionClient } from "./action-client.js";

interface Call {
  url: string;
  init?: RequestInit;
}

function fakeFetch(responseBody: unknown): { fn: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), ...(init ? { init } : {}) });
    return { json: async () => responseBody } as Response;
  };
  return { fn, calls };
}

describe("§2.1 ActionClient", () => {
  const base = "https://api.test";
  const token = () => "tok-123";

  it("send issues one POST with the bearer token and input body", async () => {
    const { fn, calls } = fakeFetch({ status: "completed" });
    const client = new ActionClient({ baseUrl: base, token, fetchImpl: fn });
    const res = await client.send("s1", "hello");
    expect(res.status).toBe("completed");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${base}/api/sessions/s1/send`);
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok-123");
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ input: "hello" });
  });

  it("list/create/confirm/cancel/approvals/delete each hit their endpoint once", async () => {
    const { fn, calls } = fakeFetch([]);
    const client = new ActionClient({ baseUrl: base, token, fetchImpl: fn });
    await client.listSessions();
    await client.createSession("n");
    await client.confirm("s1", { requestId: "r", decision: "approve" });
    await client.cancel("s1");
    await client.approvals("s1");
    await client.deleteSession("s1");
    const urls = calls.map((c) => c.url);
    expect(urls).toEqual([
      `${base}/api/sessions`,
      `${base}/api/sessions`,
      `${base}/api/sessions/s1/confirm`,
      `${base}/api/sessions/s1/cancel`,
      `${base}/api/sessions/s1/approvals`,
      `${base}/api/sessions/s1`,
    ]);
    expect(calls[5]!.init!.method).toBe("DELETE");
  });
});
