# 03 — Express and the S3 API

What was built: `server/src/b2.ts` (read-only B2 client), `server/src/app.ts` (the Express app with
`GET /api/list`), `server/src/index.ts` (starts the server).

## Express in one picture (compare: FastAPI)

```
request -> requestLog -> authSlot (/api only) -> route handler -> error handler -> response
```

Express is a chain of **middleware**: functions `(req, res, next)`. Each one either answers (`res.json`)
or calls `next()` to pass the request on. FastAPI hides this behind decorators and dependencies;
Express shows it directly. The order of `app.use(...)` calls is the order of the chain.

- `requestLog` prints one line when the response finishes (`res.on("finish", ...)`).
- `authSlot` does nothing today. Later, Google sign-in goes here, and every `/api` route is protected
  without touching the routes.
- The **error handler** has four parameters `(err, req, res, next)`. Express recognises it by that.

## Async errors (Express 5)

```ts
app.get("/api/list", async (req, res) => {
  const prefix = validatePrefix(req.query.prefix, config.rawPrefix); // may throw HttpError(400)
  ...
});
```

In Express 5 an error thrown inside an `async` handler goes straight to the error handler. (Express 4
needed `try/catch` + `next(err)` in every route.) So routes stay short: throw `HttpError`, and the
handler turns it into `{ "error": "..." }` with the right status.

The client only sees a short message (`B2 unavailable`). The real error, which may contain internal
details, goes to the server log via `err.cause`.

## Dependency injection, the simple way

`createApp({ config, b2 })` receives its B2 client as a parameter instead of creating it. Production
passes the real client; tests pass a fake. Same idea as FastAPI's `app.dependency_overrides`.

`createB2(config, client?)` does the same one level lower: tests pass `fakeS3`, an in-memory object
with a `send()` method, so the **real** paging and error-mapping code runs in tests.

## AWS SDK v3 vs boto3

```python
s3.list_objects_v2(Bucket=b, Prefix=p, Delimiter="/")          # boto3
```

```ts
await s3.send(new ListObjectsV2Command({ Bucket: b, Prefix: p, Delimiter: "/" }));  // SDK v3
```

Each operation is a command class; you `send` it. Only three are imported (`ListObjectsV2`,
`HeadObject`, `GetObject`), so this code cannot write to B2 even by mistake. The read-only key is the
second lock.

## Pagination

`ListObjectsV2` returns at most 1,000 entries per call. The `do { ... } while (token)` loop asks again
with `ContinuationToken` until `IsTruncated` is false. The test lists 1,500 files through a fake that
pages at 1,000, which proves the loop.

## Starting the server

`index.ts` loads `.env` from the repo root (only if it exists), builds the config, and listens on
`HOST:PORT` (default `127.0.0.1:3000`, so only this computer can connect). Without the required
variables it stops with a clear message instead of starting half-broken.
