# 02 — TypeScript pure modules

What was built: `server/src/keys.ts` (rules for which B2 paths the API accepts, batch date from a folder
name, `.cache` PNG locations, natural name sort) and `server/src/listing.ts` (turns a raw B2 listing
into the folders and files the UI shows).

## Why "pure"

Neither file talks to B2, the disk, or the network. Input in, output out. This is the same idea as
keeping a Python parser separate from the code that opens files: the logic gets fast tests with no
setup, and the I/O code (next task) stays thin.

## Types vs Python type hints

```ts
export type FileEntry = { name: string; key: string; size: number; uploaded: string; date: string | null };
```

Close to a Python `TypedDict`. Differences:

- TypeScript checks types at **compile time** (`tsc`), and the build fails on a mismatch. Python hints
  are only checked if you run mypy.
- `string | null` is `str | None`.
- `type` describes shape only. At runtime it is a plain JavaScript object; nothing is enforced while the
  program runs. That is why `validateKey(value: unknown, ...)` takes `unknown`: a query parameter can be
  anything (missing, an array), and the function checks it before trusting it.

## Security rule in one place

`validateKey` / `validatePrefix` are the gate for every API call. A path must start with `yeast/`, must
not contain a `..` segment or a backslash, and must not start with `/`. Doing this in one function
means every route gets the same rule, and the tests (`test.each` with nine bad inputs) prove it.

## Natural sort with `Intl.Collator`

```ts
new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare
```

Built into JavaScript. `numeric: true` compares digit runs as numbers (`cell_2` before `cell_10`);
`sensitivity: "base"` ignores case. In Python you would write a key function with `re.split`.

## Dates

`batchDate` builds a real `Date` and checks that the year, month and day did not roll over.
`2026-13-40` would silently become a date in 2027 otherwise; the check rejects it.

## `test.each`

```ts
test.each(["a", "b"])("accepts %s", (k) => ...)
```

Same as `@pytest.mark.parametrize`: one test per value, each reported separately.
