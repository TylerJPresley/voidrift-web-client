/**
 * The HTTP action client (web-blueprint.md §2.1).
 *
 * Every browser action is one REST call to the backend; the backend maps it to
 * exactly one CoreAPI operation (§2.1). The client issues the action and renders
 * the relay — it never chains calls to synthesize behavior the core does not
 * offer. The bearer token scopes the request; no secret is ever stored beyond
 * the IdP-issued token the browser already holds (§4.1, §7).
 */
import type { SessionInfo, TurnResult, ApprovalResponse, PendingApproval } from "../events/wire.js";

export interface ActionClientOptions {
  readonly baseUrl: string;
  /** Returns the current bearer token (from the IdP session, §4.1). */
  readonly token: () => string;
  /** The fetch implementation; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

export class ActionClient {
  constructor(private readonly opts: ActionClientOptions) {}

  private get f(): typeof fetch {
    return this.opts.fetchImpl ?? fetch;
  }

  private headers(): HeadersInit {
    return { authorization: `Bearer ${this.opts.token()}`, "content-type": "application/json" };
  }

  async listSessions(): Promise<SessionInfo[]> {
    const res = await this.f(`${this.opts.baseUrl}/api/sessions`, { headers: this.headers() });
    return (await res.json()) as SessionInfo[];
  }

  async createSession(name?: string): Promise<SessionInfo> {
    const res = await this.f(`${this.opts.baseUrl}/api/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(name ? { name } : {}),
    });
    return (await res.json()) as SessionInfo;
  }

  async send(sessionId: string, input: string): Promise<TurnResult> {
    const res = await this.f(`${this.opts.baseUrl}/api/sessions/${sessionId}/send`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ input }),
    });
    return (await res.json()) as TurnResult;
  }

  async confirm(sessionId: string, response: ApprovalResponse): Promise<TurnResult> {
    const res = await this.f(`${this.opts.baseUrl}/api/sessions/${sessionId}/confirm`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(response),
    });
    return (await res.json()) as TurnResult;
  }

  async cancel(sessionId: string): Promise<void> {
    await this.f(`${this.opts.baseUrl}/api/sessions/${sessionId}/cancel`, {
      method: "POST",
      headers: this.headers(),
    });
  }

  async approvals(sessionId: string): Promise<PendingApproval[]> {
    const res = await this.f(`${this.opts.baseUrl}/api/sessions/${sessionId}/approvals`, {
      headers: this.headers(),
    });
    return (await res.json()) as PendingApproval[];
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.f(`${this.opts.baseUrl}/api/sessions/${sessionId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }
}
