# 05 — Solid stores and components

What was built: the Explorer screen. `web/src/store.ts` holds the app state;
`web/src/components/` has one file per part of the window (TopBar, FolderTree, DateFilter, FileArea,
DetailsView, PreviewPane, StatusBar); `web/src/lib/rows.ts` has the pure helpers (date range, search,
sort, sizes).

## A store is just signals in a module

React apps often need Context or Redux to share state. In Solid, signals work anywhere, so the store
is a plain module:

```ts
export const store = createRoot(createStore);
```

Any component does `import { store } from "../store"` and reads `store.currentPrefix()`. Only the DOM
spots that read a signal update when it changes. `createRoot` gives these long-lived computations an
owner (otherwise Solid warns that they can never be cleaned up).

Navigation lives in one place: `navigate(prefix)` pushes the old folder on a history stack, clears the
selection and the search. Back, Up, the address bar, the tree and double-click all call it, so they
behave the same.

## Derived values: `createMemo` (compare: `useMemo`)

```ts
const visibleFiles = createMemo(() =>
  sortFiles(files.filter((f) => matchesSearch(f.name, search())), sortColumn(), sortDir()));
```

No dependency array. Solid records which signals the function read (`search()`, `sortColumn()`, ...)
and re-runs it only when one of them changes. React's `useMemo(fn, [deps])` makes you list them by
hand, and a missing dependency is a classic bug.

A plain function `() => store.visibleFolders().length + ...` is also reactive when called inside JSX.
`createMemo` is only worth it when the result is used in several places or is costly (sorting 1,000
files).

## Props are getters: never destructure

```tsx
function TreeNode(props: NodeProps) {
  ... props.prefix ...          // good: reads the current value each time
}
// function TreeNode({ prefix }) // bad in Solid: reads once, never updates
```

Solid passes props as an object with getters. Destructuring reads them once, when the component runs
(remember: components run only once), and loses reactivity. In React destructuring is normal.

## A lazy tree with one resource per node

Each `TreeNode` has its own `expanded` signal and its own resource:

```ts
const [children] = createResource(() => (expanded() ? props.prefix : false), listFolder);
```

When the source is `false`, Solid does not fetch. So a folder's children load only when it is first
expanded. Expanding the root shows the batches; the date filter is applied to that level only.

## Event handlers

`onClick`, `onDblClick`, `onInput` look like React, but they are real DOM events (Solid uses event
delegation for speed). `e.stopPropagation()` on a row stops the click from reaching the file area,
whose own click clears the selection: clicking empty space deselects, like Explorer.

## Checked in the browser (fake data)

Back, Up and address parts navigate; search filters the current folder; From = 2026-10-07 hides older
and undated batches in both the tree and the list, and clearing it shows them again; Size sorts both
ways; a 1,000-file folder renders in about 20 ms and re-sorts in about 10 ms.

One thing seen while developing: Vite's hot reload re-ran `store.ts` after an edit, which created a
second store while old components still used the first. A full page reload fixed it. This only
happens in development.
