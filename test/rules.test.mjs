import test from "node:test"
import assert from "node:assert/strict"

import {
  conditionalRuleCount,
  matchingRules,
  matchesGlob,
  renderInjectedInstructions,
  renderInstructionStatus,
} from "../dist/src/rules.js"

const alwaysRule = { globs: null, content: "Always content", path: "always.md" }
const typescriptRule = { globs: ["src/**/*.ts"], content: "TypeScript content", path: "typescript.md" }
const rubyRule = { globs: ["app/**/*.rb"], content: "Ruby content", path: "ruby.md" }

test("matchesGlob matches files and directory paths", () => {
  assert.equal(matchesGlob("src/index.ts", "src/**/*.ts"), true)
  assert.equal(matchesGlob("apps/joblab", "apps/joblab/**"), true)
  assert.equal(matchesGlob("src/index.js", "src/**/*.ts"), false)
})

test("matchingRules returns always rules and matching conditional rules", () => {
  assert.deepEqual(matchingRules([alwaysRule, typescriptRule, rubyRule], ["src/index.ts"]), [
    alwaysRule,
    typescriptRule,
  ])
})

test("conditionalRuleCount excludes always-active rules", () => {
  assert.equal(conditionalRuleCount([alwaysRule, typescriptRule, rubyRule]), 2)
})

test("renderInjectedInstructions emits separate always and conditional blocks", () => {
  const output = renderInjectedInstructions([alwaysRule, typescriptRule])

  assert.equal(output.length, 2)
  assert.match(output[0], /type="always"/)
  assert.match(output[0], /Always content/)
  assert.match(output[1], /type="conditional"/)
  assert.match(output[1], /TypeScript content/)
})

test("renderInstructionStatus reports active and pending conditional rules", () => {
  const output = renderInstructionStatus([alwaysRule, typescriptRule, rubyRule], ["src/index.ts"])

  assert.match(output, /Always-active \(no applyTo\) — 1 files/)
  assert.match(output, /Active \(1\):/)
  assert.match(output, /typescript\.md/)
  assert.match(output, /Pending — no matching files yet \(1\):/)
  assert.match(output, /ruby\.md/)
})
