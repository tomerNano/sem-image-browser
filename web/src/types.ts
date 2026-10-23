// Copy of the server's API types (server/src/listing.ts). Keep both in sync.
export type FolderEntry = { name: string; prefix: string; date: string | null };
/** `uploaded` is an ISO 8601 timestamp. */
export type FileEntry = { name: string; key: string; size: number; uploaded: string; date: string | null };
export type ListResult = { folders: FolderEntry[]; files: FileEntry[] };
