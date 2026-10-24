/**
 * Parse CSV text (RFC 4180) into one record per row, keyed by the header row.
 * Handles quoted fields with commas, doubled quotes ("") and line breaks, and both \n and \r\n.
 * Blank lines are skipped; a short row gets "" for its missing columns.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const [header, ...body] = nonEmpty;
  if (!header) return [];
  // A UTF-8 byte order mark would otherwise stick to the first column name.
  header[0] = header[0].replace(/^﻿/, "");
  return body.map((r) => Object.fromEntries(header.map((name, i) => [name, r[i] ?? ""])));
}
