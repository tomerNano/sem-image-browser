# Architecture tour page — Design (short)

Date: 2026-11-17. Author: Tomer (with Claude). Status: approved 2026-11-17.

## Intent and why

Tomer hands the b2-GUI to a senior engineer for review. Before that, Tomer wants to understand the
whole system well enough to:

1. defend each design decision,
2. trace one user action through the code, live, in front of the senior,
3. answer security questions.

The page is a learning tool for Tomer first. The senior can read it too.

## Goals

- One self-contained HTML page: `docs/learn/16-architecture-tour.html`.
- Focus on runtime behavior: how `web/src` files work together, how the browser talks to the
  server, event listeners, reactive effects, and the life cycle of a request.
- Every code reference shows `path:line` as plain text and as a `vscode://file/<abs path>:<line>`
  link that opens VS Code at that line on Tomer's PC.
- Pinned to commit `d851b99`; the page says so at the top.

## Non-goals

- CSS, layout and visual styling of the app.
- Repeating the 15 notes in `docs/learn/`. The page links to them for depth.
- Changes to app code.

## Anti-goals

- Wrong line numbers or invented behavior. Every claim and `path:line` is checked against the code.
- A page that needs a build step, a server or a network connection to read (no CDN scripts).

## Approaches

- **A. Static long page** (diagram, traces as text, listener table, decisions, security Q&A).
  Cheapest; traces read as a wall of text.
- **B. A plus step-through traces (chosen).** Each trace has Back/Next; each step highlights one box
  in the system diagram and shows the code at its `path:line`. Best fit for "trace a click live".
  About 30% more work than A.
- **C. Markdown chapter** in `docs/learn/`. Fits the other notes; no interaction; Tomer asked for HTML.

## Page content

1. **Big picture**: inline SVG diagram — Browser (index.tsx, App, store, history, api, components)
   ↔ Express (`app.ts` routes) ↔ B2 / Registry (GitHub or file) / disk cache / sharp renderer.
2. **Step-through traces** (each 6–12 steps, diagram box highlighted per step):
   - Page load (`index.tsx` → `/api/root` → `store.init` → `syncHistory` → `render`).
   - Open a folder (click → `store.navigate` → `createResource` → `listFolder` memo →
     `/api/list` → `listing.ts`/`b2.ts` + Registry meta → memo chain → re-render).
   - Select an image and preview (`clickItem` → `selected` memo → PreviewPane → `/api/preview` →
     limiter → disk cache → sharp convert).
   - Open the viewer and step through files (keyboard listener, `stepViewer`).
   - Browser Back (`popstate` → `store.navigate` → effect skip).
   - Zip download (hidden form + iframe → `POST /api/download-zip` → `zip.ts` stream).
3. **Listener and effect inventory**: table of every `addEventListener`, `onMount`/`onCleanup`,
   `createEffect`, `createResource`, with `path:line` and what removes it.
4. **Reactive graph of `store.ts`**: which signals feed which memos (small SVG or nested list).
5. **Decision log**: each decision, the alternatives, why chosen (from the design spec, plans,
   and code comments). Examples: SolidJS over React, server proxy instead of presigned URLs,
   module-level store, browser history for navigation, 30 s listing memo, ETag in cache names,
   concurrency limiter of 4, paging at 200, split groups instead of every image.
6. **Security Q&A**: read-only key, no credentials in the browser, Host check, CSP, same-site
   POST checks, loopback-only, empty `authSlot`, what is still open.
7. **Links** to the matching `docs/learn/` notes.

## Builder's calls

- Plain HTML + inline CSS + small vanilla JS; no libraries. Light and dark theme via CSS variables.
- Absolute path for `vscode://` links is a single constant at the top of the page script, so it can
  be changed for another PC.
- Committed on branch `docs/architecture-tour`.
