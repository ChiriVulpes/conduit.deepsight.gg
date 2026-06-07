This repository is a global service-worker-backed data bridge for Destiny/deepsight apps.

The normal host flow is:
1. A host page imports the client package.
2. The client injects a hidden iframe pointed at the conduit service origin.
3. The iframe registers the service worker.
4. Host messages pass through the iframe to the service worker.
5. The service worker handles data/auth/cache work and replies through the iframe.

## Project Map

Primary areas:
- `src/shared`: shared types and API contracts.
- `src/client`: public client package loaded by host pages. It creates the hidden conduit iframe and exposes the public API.
- `src/frame`: iframe bridge. It registers the service worker and forwards messages between host pages and the service worker.
- `src/service`: service worker implementation, Bungie/deepsight data models, auth, IndexedDB cache, definitions, inventory, collections, and item transfer.
- `src/platform`: conduit service-domain UI, static assets, Chiri styles, and Weaving translations.
- `task`: task-runner entrypoints for install, validation, build, watch, packaging, static copying, Chiri, Weaving, and TypeScript orchestration.

Avoid editing:
- `out/`
- `node_modules/`
- generated declaration files
- generated Chiri or Weaving typings
- build info files
- bundle/vendor-like files unless the user asks or the task genuinely requires it

## Frontend Work
Before editing kitsui components, Chiri styles, or Weaving translation files, read `../deepsight.gg/FRONTEND.md`.

Use the local frontend systems:
- kitsui for components, state, lifecycle, and interaction
- Chiri for styles
- Weaving quilt files for user-facing text

## Permission and Auth Boundaries
Conduit uses three practical permission levels:

- Level 0: public readonly access. No stored origin grant. Profile visibility is tolerated, but public clients must not get account mutation capabilities.
- Level 1: account grant from `Auth.getOriginAccess(origin)`. Account-backed write actions and mutations require this level.
- Level 2: trusted origin from `Auth.isOriginTrusted(origin)`. Trusted/dev-only behavior such as `evalExpression` requires this level.

Some keys in `.env` are explicitly published as runtime-public configuration in this project, served by design.

Stored auth is sensitive. Be careful around tokens, refresh flows, custom Bungie app settings, origin grants, and service-worker auth state. Do not log, expose, serialize, or weaken these paths casually.

High-risk files for auth and permissions include:
- `src/frame/frame.ts`
- `src/service/utility/Service.ts`
- `src/service/model/Auth.ts`
- `src/service/Conduit.ts`
- `src/service/action/ItemTransfer.ts`

When editing public service methods, check the `event.origin` path and preserve the relevant Level 0, Level 1, or Level 2 boundary at the service entrypoint. Do not rely on UI flow or client-side TypeScript types as the permission boundary.

## Validation
Run these validation commands in parallel:
- `pnpm exec lint`
- `pnpm exec task typecheck`

`pnpm exec task validate` remains a serial wrapper around lint and typecheck when parallel execution is not practical.
Do not run build-style or watch-style tasks unless the user explicitly approves them.
