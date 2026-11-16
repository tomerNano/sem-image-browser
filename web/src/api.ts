import { memoByKey } from "./lib/memo";
import type { ListResult, RegistryStatus, SplitGroups } from "./types";

/** Where browsing starts (the server's B2_RAW_PREFIX). */
export async function getRoot(): Promise<{ prefix: string; name: string }> {
  const res = await fetch("/api/root");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/**
 * How long a folder listing is reused. The file area, the folder tree and the preview pane each
 * ask for the same folder; without this, opening a split lists it in B2 two or three times.
 * New files show after at most this long, or at once after a page reload.
 */
const LIST_TTL_MS = 30_000;

/** One folder level from the backend. Throws an Error with the server's message on failure. */
async function fetchListing(prefix: string): Promise<ListResult> {
  const res = await fetch(`/api/list?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/** One folder level, shared by every part of the page for LIST_TTL_MS. */
export const listFolder = memoByKey(fetchListing, LIST_TTL_MS);

/** How long the split groups are reused; the server checks the Registry once a minute too. */
const SPLIT_GROUPS_TTL_MS = 60_000;

/** Registry image groups of every split, for the Field filters at the top level. */
async function fetchSplitGroups(): Promise<SplitGroups> {
  const res = await fetch("/api/split-groups");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()).splits;
}

const splitGroupsOnce = memoByKey(fetchSplitGroups, SPLIT_GROUPS_TTL_MS);

/** Image groups by split, shared by every caller for SPLIT_GROUPS_TTL_MS. */
export const getSplitGroups = () => splitGroupsOnce("all");

/** Whether the server has Registry metadata (for the status bar warning). */
export async function getRegistryStatus(): Promise<RegistryStatus> {
  const res = await fetch("/api/registry");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

const keyUrl = (route: string) => (key: string) => `/api/${route}?key=${encodeURIComponent(key)}`;

/**
 * Image URLs carry the file's upload time (`v`), so a file replaced in B2 gets a new URL and the
 * browser does not reuse its cached copy of the old image. The server ignores `v`.
 */
const imageUrl = (route: string) => (key: string, uploaded: string) =>
  `${keyUrl(route)(key)}&v=${encodeURIComponent(uploaded)}`;

export const thumbUrl = imageUrl("thumb");
export const previewUrl = imageUrl("preview");
export const downloadUrl = keyUrl("download");

/** Most files one zip download may hold (the server's MAX_ZIP_FILES). */
export const MAX_ZIP_FILES = 1000;

/**
 * Downloads several files of one folder as one zip. A hidden form posts the keys into a hidden
 * frame, so the page stays put and the browser's own download manager streams the zip to disk.
 */
export function downloadZip(keys: string[]): void {
  const frame = document.createElement("iframe");
  frame.name = `zip-download-${Date.now()}`;
  frame.hidden = true;
  const form = document.createElement("form");
  form.method = "post";
  form.action = "/api/download-zip";
  form.target = frame.name;
  form.hidden = true;
  for (const key of keys) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "key";
    input.value = key;
    form.append(input);
  }
  document.body.append(frame, form);
  form.submit();
  form.remove();
  // Removing the frame before the server answers would cancel the download; by now it has
  // been handed to the browser's download manager.
  setTimeout(() => frame.remove(), 5 * 60_000);
}
