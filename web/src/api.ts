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
 * Image URLs carry the file's upload time (`v`). The browser caches images by URL, so a file
 * replaced in B2 gets a new URL and never shows a stale copy. The server ignores `v`.
 */
const imageUrl = (route: string) => (key: string, uploaded: string) =>
  `${keyUrl(route)(key)}&v=${encodeURIComponent(uploaded)}`;

export const thumbUrl = imageUrl("thumb");
export const previewUrl = imageUrl("preview");
export const downloadUrl = keyUrl("download");
