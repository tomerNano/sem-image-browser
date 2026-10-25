import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { listFolder } from "../api";
import { inDateRange } from "../lib/rows";
import { store } from "../store";
import { ChevronIcon, FolderIcon } from "./Icons";
import SidebarToggle from "./SidebarToggle";

/** `date` is set for batch folders: their name starts with "YYYY-MM-DD_". */
type NodeProps = { name: string; prefix: string; date: string | null; depth: number };

/** One folder in the tree. Its children are fetched only when it is first expanded. */
function TreeNode(props: NodeProps) {
  const isRoot = props.prefix === store.root().prefix;
  const [expanded, setExpanded] = createSignal(isRoot);
  const [children] = createResource(() => (expanded() ? props.prefix : false), listFolder);

  // Opening a folder from the file area expands its ancestors, like Explorer.
  createEffect(() => {
    const current = store.currentPrefix();
    if (current !== props.prefix && current.startsWith(props.prefix)) setExpanded(true);
  });

  const visibleChildren = () => {
    const folders = children.error ? [] : (children()?.folders ?? []);
    if (!isRoot) return folders;
    return folders.filter((f) => inDateRange(f.date, store.dateFrom(), store.dateTo()));
  };

  return (
    <li>
      <div
        class="tree-row"
        classList={{ current: store.currentPrefix() === props.prefix }}
        style={{ "padding-left": `${4 + props.depth * 14}px` }}
        onClick={() => store.navigate(props.prefix)}
      >
        <button
          class="twisty"
          aria-label={expanded() ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((x) => !x);
          }}
        >
          <ChevronIcon open={expanded()} />
        </button>
        <FolderIcon />
        <Show when={props.date && props.name.startsWith(props.date + "_")} fallback={<span class="tree-name" title={props.name}>{props.name}</span>}>
          <span class="tree-date">{props.date}</span>
          <span class="tree-name" title={props.name}>
            {props.name.slice(props.date!.length + 1)}
          </span>
        </Show>
      </div>
      <Show when={expanded()}>
        <Show when={children.error}>
          <div class="tree-error" style={{ "padding-left": `${22 + props.depth * 14}px` }}>
            Could not load
          </div>
        </Show>
        <ul>
          <For each={visibleChildren()}>
            {(child) => <TreeNode name={child.name} prefix={child.prefix} date={child.date} depth={props.depth + 1} />}
          </For>
        </ul>
      </Show>
    </li>
  );
}

export default function FolderTree() {
  return (
    <aside class="sidebar">
      <div class="brand">
        {/* Full logo while open; only the emblem shows in the narrow closed rail. */}
        <img class="brand-logo" src="/nanoscout-logo-reversed.png" alt="NanoScout" />
        <img class="brand-mark" src="/nanoscout-mark.png" alt="NanoScout" />
        <SidebarToggle />
      </div>
      <ul class="tree">
        <TreeNode name={store.root().name} prefix={store.root().prefix} date={null} depth={0} />
      </ul>
    </aside>
  );
}
