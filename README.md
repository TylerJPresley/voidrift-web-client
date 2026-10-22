# voidrift-web-client

VoidRift Web UI frontend — the thin browser client: SSR shell, streaming transcript, approvals, panels, accessible (WCAG 2.1 AA). Reaches the SDK only through the web-server HTTP + WebSocket surface (web-blueprint.md).

Part of VoidRift, a local-first, model-agnostic AI agent harness. Status: work in progress. Not yet usable or released. The VoidRift CLI and core are the current focus.

## Requirements
- Node.js >=22

## Build from source
```bash
git clone https://github.com/TylerJPresley/voidrift-web-client.git
cd voidrift-web-client
npm install
npm run build
npm test
```

## License
Apache-2.0. See [LICENSE](LICENSE).
