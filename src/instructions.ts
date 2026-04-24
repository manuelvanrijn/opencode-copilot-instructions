import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

export const FRONTMATTER_RE = /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

export interface InstructionRule {
  /** Glob patterns from `applyTo:` frontmatter. null = always inject. */
  globs: string[] | null
  content: string
  path: string
}

type Logger = (...args: unknown[]) => void

export function stripFrontmatter(raw: string): string {
  return raw.replace(FRONTMATTER_RE, "").trim()
}

/**
 * Parse `applyTo:` from YAML frontmatter.
 * Supports comma-separated glob lists.
 */
export function parseApplyTo(raw: string): string[] {
  const frontmatter = raw.match(FRONTMATTER_RE)?.[1]
  if (!frontmatter) return []

  const match = frontmatter.match(/^\s*applyTo\s*:\s*(.*)\s*$/m)
  if (!match) return []

  const value = match[1].trim().replace(/^["']|["']$/g, "")
  if (!value || value === "[]") return []

  return value
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
}

export function hasApplyTo(raw: string): boolean {
  const frontmatter = raw.match(FRONTMATTER_RE)?.[1]
  return Boolean(frontmatter?.match(/^\s*applyTo\s*:/m))
}

export function parseInstructionFile(raw: string, path: string): InstructionRule | null {
  const explicitApplyTo = hasApplyTo(raw)
  const globs = explicitApplyTo ? parseApplyTo(raw) : null

  if (globs?.length === 0) return null

  return {
    globs,
    content: stripFrontmatter(raw),
    path,
  }
}

export async function loadRules(directory: string, log: Logger = () => {}): Promise<InstructionRule[]> {
  const rules: InstructionRule[] = []

  const copilotInstructionsPath = join(directory, ".github", "copilot-instructions.md")
  try {
    const raw = await readFile(copilotInstructionsPath, "utf8")
    rules.push({ globs: null, content: stripFrontmatter(raw), path: "copilot-instructions.md" })
    log("Loaded: copilot-instructions.md (always)")
  } catch {
    // File does not exist, skip silently.
  }

  const instructionsDir = join(directory, ".github", "instructions")
  let files: string[]

  try {
    files = (await readdir(instructionsDir)).sort()
  } catch {
    log("No .github/instructions/ directory found, skipping")
    return rules
  }

  for (const file of files) {
    if (!file.endsWith(".md")) continue

    const raw = await readFile(join(instructionsDir, file), "utf8")
    const rule = parseInstructionFile(raw, file)

    if (!rule) {
      log(`Skipped: ${file} (empty applyTo)`)
      continue
    }

    rules.push(rule)
    log(`Loaded: ${file} ${rule.globs === null ? "(always)" : `(applyTo: ${rule.globs.join(", ")})`}`)
  }

  const alwaysCount = rules.filter((r) => r.globs === null).length
  const conditionalCount = rules.filter((r) => r.globs !== null).length
  log(`Total: ${rules.length} rules (${alwaysCount} always, ${conditionalCount} conditional)`)

  return rules
}
