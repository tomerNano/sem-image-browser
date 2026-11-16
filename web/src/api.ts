import type { ListResult, RegistryStatus } from "./types";

/** Where browsing starts (the server's B2_RAW_PREFIX). */
export async function getRoot(): Promise<{ prefix: string; name: string }> {
  const res = await fetch("/api/root");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** One folder level from the backend. Throws an Error with the server's message on failure. */
export async function listFolder(prefix: string): Promise<ListResult> {
  const res = await fetch(`/api/list?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

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
