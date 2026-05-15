import { minimatch } from "minimatch"

import type { InstructionRule } from "./instructions.js"

export function matchesGlob(filePath: string, glob: string): boolean {
  return (
    minimatch(filePath, glob, { matchBase: false, dot: true }) ||
    (!filePath.endsWith("/") && minimatch(filePath + "/", glob, { matchBase: false, dot: true }))
  )
}

export function matchingRules(rules: InstructionRule[], contextPaths: Iterable<string>): InstructionRule[] {
  const paths = Array.from(contextPaths)

  return rules.filter((rule) =>
    rule.globs === null || paths.some((path) => rule.globs!.some((glob) => matchesGlob(path, glob)))
  )
}

export function conditionalRuleCount(rules: InstructionRule[]): number {
  return rules.filter((rule) => rule.globs !== null).length
}

export function renderInjectedInstructions(rules: InstructionRule[]): string[] {
  const { alwaysRules, conditionalRules } = splitRules(rules)
  const alwaysContent = alwaysRules.map((rule) => rule.content)
  const conditionalContent = conditionalRules.map((rule) => rule.content)
  const output: string[] = []

  if (alwaysContent.length > 0) output.push(wrapInstructions(alwaysContent, "always"))
  if (conditionalContent.length > 0) output.push(wrapInstructions(conditionalContent, "conditional"))

  return output
}

export function renderInstructionStatus(rules: InstructionRule[], contextPaths: string[]): string {
  const { alwaysRules, conditionalRules } = splitRules(rules)
  const activeConditional = matchingRules(conditionalRules, contextPaths)
  const pendingConditional = conditionalRules.filter((rule) => !activeConditional.includes(rule))

  const lines: string[] = [
    `## Copilot Instructions Status`,
    ``,
    `### Always-active (no applyTo) — ${alwaysRules.length} files`,
    ...alwaysRules.map((rule) => `- ✓ ${rule.path}`),
    ``,
    `### Conditional (applyTo) — ${conditionalRules.length} files`,
    `Active (${activeConditional.length}):`,
    ...activeConditional.map((rule) => `- ✓ ${rule.path} [${rule.globs!.join(", ")}]`),
    `Pending — no matching files yet (${pendingConditional.length}):`,
    ...pendingConditional.map((rule) => `- ○ ${rule.path} [${rule.globs!.join(", ")}]`),
    ``,
    `### Context paths seen this session (${contextPaths.length})`,
    ...contextPaths.map((path) => `- ${path}`),
  ]

  return lines.join("\n")
}

function wrapInstructions(contents: string[], label: string): string {
  return `<project_instructions type="${label}">\nThe following project-specific instructions MUST be followed. Apply them immediately and for all subsequent actions.\n\n${contents.join("\n\n---\n\n")}\n</project_instructions>`
}

function splitRules(rules: InstructionRule[]): {
  alwaysRules: InstructionRule[]
  conditionalRules: InstructionRule[]
} {
  return {
    alwaysRules: rules.filter((rule) => rule.globs === null),
    conditionalRules: rules.filter((rule) => rule.globs !== null),
  }
}
