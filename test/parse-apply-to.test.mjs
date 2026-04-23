import test from "node:test"
import assert from "node:assert/strict"

import { parseApplyTo } from "../dist/src/index.js"

test("returns empty when no frontmatter exists", () => {
  assert.deepEqual(parseApplyTo("# Instructions"), [])
})

test("parses single applyTo pattern", () => {
  const raw = `---
applyTo: "app/models/**/*.rb"
---
# Instructions`

  assert.deepEqual(parseApplyTo(raw), ["app/models/**/*.rb"])
})

test("parses comma-separated applyTo patterns", () => {
  const raw = `---
applyTo: "**/*.ts,**/*.tsx"
---
# Instructions`

  assert.deepEqual(parseApplyTo(raw), ["**/*.ts", "**/*.tsx"])
})

test("parses applyTo when additional frontmatter keys exist", () => {
  const raw = `---
applyTo: "**"
excludeAgent: "code-review"
---
# Instructions`

  assert.deepEqual(parseApplyTo(raw), ["**"])
})

test("parses applyTo regardless of key order", () => {
  const raw = `---
excludeAgent: "code-review"
applyTo: "src/**/*.py"
---
# Instructions`

  assert.deepEqual(parseApplyTo(raw), ["src/**/*.py"])
})

test("parses documented glob examples list", () => {
  const raw = `---
applyTo: "*,**,**/*,*.py,**/*.py,src/*.py,src/**/*.py,**/subdir/**/*.py"
---
# Instructions`

  assert.deepEqual(parseApplyTo(raw), [
    "*",
    "**",
    "**/*",
    "*.py",
    "**/*.py",
    "src/*.py",
    "src/**/*.py",
    "**/subdir/**/*.py",
  ])
})

test("supports CRLF frontmatter and spacing around commas", () => {
  const raw = "---\r\napplyTo: \"**/*.ts, **/*.tsx\"\r\nexcludeAgent: \"code-review\"\r\n---\r\n# Instructions"
  assert.deepEqual(parseApplyTo(raw), ["**/*.ts", "**/*.tsx"])
})

test("returns empty when frontmatter has no applyTo", () => {
  const raw = `---
excludeAgent: "code-review"
---
# Instructions`

  assert.deepEqual(parseApplyTo(raw), [])
})
