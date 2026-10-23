# 01 — Node project setup

What was built: the empty project skeleton, and `server/src/config.ts`, which reads settings from
environment variables.

## npm workspaces (compare: uv)

`package.json` is the Node equivalent of `pyproject.toml`. The root one lists two **workspaces**,
`server` and `web`. Each has its own `package.json` with its own dependencies, but `npm install` at the
root installs everything into one shared `node_modules/` (like a single `.venv`). `package-lock.json` is
the equivalent of `uv.lock`: exact versions, committed.

Run a script inside one workspace with `-w`:

```
npm -w server test -- test/config.test.ts
```

`--` passes the rest to the script (here: `vitest run test/config.test.ts`).

`dependencies` are needed at runtime (`express`, `sharp`, ...). `devDependencies` only while developing
or building (`typescript`, `vitest`, `tsx`). `tsx` runs TypeScript directly, like `uv run python`;
`tsc` compiles TypeScript to JavaScript into `dist/` for production.

## ES modules

`"type": "module"` means files use `import` / `export` (like Python imports), not the older
`require()`. One surprise: inside TypeScript you import `../src/config.js`, with a `.js` ending, even
though the file is `config.ts`. The import names the file that will exist **after** compilation.
`"module": "NodeNext"` in `tsconfig.json` enforces this.

## tsconfig.json

`strict: true` turns on full type checking (like running mypy in strict mode, but built in and
enforced on every build). `rootDir: src` and `outDir: dist` say where code comes from and where
compiled JavaScript goes.

## The code: `loadConfig(env, rootDir)`

- It takes the environment as a **parameter** instead of reading `process.env` itself. That makes it a
  pure function: the test passes a plain object, no real environment needed.
- Missing variables are collected and reported together, by name only. A secret value never appears
  in an error message.
- `!` in `env.AWS_ACCESS_KEY_ID!` tells TypeScript "I already checked this is not undefined".
- Paths use `path.join`, so they work on Windows and Linux. (`path.resolve` was tried first; on Windows
  it adds a drive letter, which the test caught.)

## Vitest (compare: pytest)

| pytest | Vitest |
|---|---|
| `def test_x():` | `test("x", () => { ... })` |
| `assert a == b` | `expect(a).toBe(b)` (or `toEqual` for objects) |
| `pytest.raises(E, match=...)` | `expect(() => f()).toThrow(/regex/)` |
| `@pytest.mark.parametrize` | `test.each([...])` |
