import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import {
  extractPathsFromText,
  extractToolOutputText,
  normalizeContextPath,
  normalizePathSeparators,
} from "../dist/src/paths.js"

test("extractPathsFromText finds file-like paths and strips punctuation", () => {
  assert.deepEqual(extractPathsFromText("Read ./src/index.ts, then test/plugin.test.mjs."), [
    "./src/index.ts",
    "test/plugin.test.mjs",
  ])
})

test("extractPathsFromText ignores URLs and email-like text", () => {
  assert.deepEqual(extractPathsFromText("See https://example.com/src/index.ts and a/b@example.com"), [])
})

test("normalizePathSeparators converts backslashes", () => {
  assert.equal(normalizePathSeparators("src\\index.ts"), "src/index.ts")
})

test("normalizeContextPath returns workspace-relative paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode-paths-"))

  assert.equal(normalizeContextPath(directory, join(directory, "src/index.ts")), "src/index.ts")
  assert.equal(normalizeContextPath(directory, "./src/index.ts"), "src/index.ts")
})

test("normalizeContextPath rejects paths outside the workspace", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode-paths-"))
  const outside = await mkdtemp(join(tmpdir(), "opencode-outside-"))

  assert.equal(normalizeContextPath(directory, join(outside, "src/index.ts")), null)
})

test("extractToolOutputText collects nested string output", () => {
  const output = { output: ["src/index.ts", { nested: "test/index.test.mjs" }], ignored: 123 }

  assert.equal(extractToolOutputText(output), "src/index.ts\ntest/index.test.mjs")
})
