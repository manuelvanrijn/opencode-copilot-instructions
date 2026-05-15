import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { loadRules, parseInstructionFile, stripFrontmatter } from "../dist/src/instructions.js"

test("stripFrontmatter removes YAML metadata and trims content", () => {
  const raw = `---
applyTo: "src/**/*.ts"
---

# Instructions
`

  assert.equal(stripFrontmatter(raw), "# Instructions")
})

test("parseInstructionFile returns an always-active rule without applyTo", () => {
  assert.deepEqual(parseInstructionFile("# General", "general.md"), {
    globs: null,
    content: "# General",
    path: "general.md",
  })
})

test("parseInstructionFile returns a conditional rule with applyTo globs", () => {
  const raw = `---
applyTo: "src/**/*.ts, test/**/*.mjs"
---
# TypeScript`

  assert.deepEqual(parseInstructionFile(raw, "typescript.md"), {
    globs: ["src/**/*.ts", "test/**/*.mjs"],
    content: "# TypeScript",
    path: "typescript.md",
  })
})

test("parseInstructionFile rejects explicit empty applyTo", () => {
  const raw = `---
applyTo:
---
# Empty`

  assert.equal(parseInstructionFile(raw, "empty.md"), null)
})

test("loadRules loads copilot instructions and sorted instruction files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode-instructions-"))
  await mkdir(join(directory, ".github", "instructions"), { recursive: true })
  await writeFile(join(directory, ".github", "copilot-instructions.md"), "# Copilot")
  await writeFile(join(directory, ".github", "instructions", "z-last.md"), "# Last")
  await writeFile(join(directory, ".github", "instructions", "a-first.md"), "# First")

  const rules = await loadRules(directory)

  assert.deepEqual(rules.map((rule) => rule.path), [
    "copilot-instructions.md",
    "a-first.md",
    "z-last.md",
  ])
})
