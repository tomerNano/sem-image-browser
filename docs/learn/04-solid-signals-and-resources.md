# 04 — Solid signals and resources

What was built: the `web/` project (Vite + SolidJS), `web/src/api.ts` (calls the backend), and a first
temporary screen that lists one folder and lets you click into sub-folders.

## How the pieces connect in development

```
browser :5173  --/api/...-->  Vite dev server  --proxy-->  Express :3000  -->  B2
```

`vite.config.ts` has `proxy: { "/api": "http://127.0.0.1:3000" }`. The browser only ever talks to one
address, so there is no CORS setup. `npm run dev` at the repo root starts both processes with
`concurrently`.

## The big difference from React: components run once

In React, a component function runs again on every state change, and the whole JSX is rebuilt and
diffed. In Solid, `App()` runs **once**. It sets up the DOM and wires small reactive updates into it.
When state changes, only the exact text node or attribute that reads it updates.

## Signals (compare: `useState`)

```ts
const [currentPrefix, setCurrentPrefix] = createSignal("yeast/");
currentPrefix();           // read: it is a function call
setCurrentPrefix("yeast/b/");
```

The getter is a **function**. Calling `currentPrefix()` inside JSX is what subscribes that spot of the
DOM to the signal. That is why you always see `()` when reading Solid state.

## Resources (compare: `useEffect` + `fetch` + loading state)

```ts
const [listing] = createResource(currentPrefix, listFolder);
```

Whenever `currentPrefix()` changes, Solid calls `listFolder(newPrefix)`. `listing()` is the result,
`listing.loading` and `listing.error` are the state. If you click fast, an older response that arrives
late is ignored. In React you would write that by hand in a `useEffect` with a cleanup flag.

## Control flow: `<Show>` and `<For>`

- `<Show when={...}>` instead of `cond && <X/>`. It only creates its children when the condition is true.
- `<For each={list}>{(item) => ...}</For>` instead of `list.map(...)`. It keeps each row's DOM and
  only adds or removes rows that changed. You never need `key=` props.

## Errors are visible

`listFolder` throws `Error(message from the server)` on a non-2xx answer. The screen shows it in red.
Checked by stopping the backend: the page shows `Request failed (502)` instead of an empty folder.

## Same encoding everywhere

`encodeURIComponent(key)` turns `Mil 5B 10^1_gold_1.tiff` into `Mil%205B%2010%5E1_gold_1.tiff` for
the URL; Express decodes it back. Folder names with spaces and `^` work in both directions.
