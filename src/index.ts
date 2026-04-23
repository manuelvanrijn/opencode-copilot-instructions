/**
 * @manuelvanrijn/opencode-copilot-instructions
 *
 * OpenCode plugin that reads .github/instructions/*.md files with `applyTo:`
 * frontmatter and injects matching instructions into the system prompt when
 * the agent reads, edits, or writes files matching those globs.
 *
 * Files without `applyTo:` frontmatter are always injected — matching GitHub
 * Copilot's behavior for always-active instructions.
 *
 * Set COPILOT_INSTRUCTIONS_DEBUG=1 to enable verbose logging.
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { minimatch } from "minimatch"

const LOG_PREFIX = "[copilot-instructions]"
const DEBUG = process.env.COPILOT_INSTRUCTIONS_DEBUG === "1"
const log = (...args: unknown[]): void => {
  if (DEBUG) console.error(LOG_PREFIX, ...args)
}
const FRONTMATTER_RE = /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

interface InstructionRule {
  /** Glob patterns from `applyTo:` frontmatter. null = always inject. */
  globs: string[] | null
  content: string
  path: string
}

interface SessionState {
  contextPaths: Set<string>
  injectedRules: Set<string>
}

const sessions = new Map<string, SessionState>()

function getSession(id: string): SessionState {
  let state = sessions.get(id)
  if (!state) {
    state = { contextPaths: new Set(), injectedRules: new Set() }
    sessions.set(id, state)
  }
  return state
}

/**
 * Parse `applyTo:` from YAML frontmatter.
 * Supports comma-separated glob lists.
 */
export function parseApplyTo(raw: string): string[] {
  const frontmatter = raw.match(FRONTMATTER_RE)?.[1]
  if (!frontmatter) return []

  const match = frontmatter.match(/^\s*applyTo\s*:\s*(.+)\s*$/m)
  if (!match) return []

  const value = match[1].trim().replace(/^["']|["']$/g, "")
  return value
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
}

function matchesGlob(filePath: string, glob: string): boolean {
  return minimatch(filePath, glob, { matchBase: false, dot: true })
}

async function loadRules(directory: string): Promise<InstructionRule[]> {
  const instructionsDir = join(directory, ".github", "instructions")
  let files: string[]

  try {
    files = await readdir(instructionsDir)
  } catch {
    log("No .github/instructions/ directory found, skipping")
    return []
  }

  const rules: InstructionRule[] = []

  for (const file of files) {
    if (!file.endsWith(".md")) continue

    const filePath = join(instructionsDir, file)
    const raw = await readFile(filePath, "utf8")
    const globs = parseApplyTo(raw)
    const always = globs.length === 0

    // Strip YAML frontmatter before injecting content
    const content = raw.replace(FRONTMATTER_RE, "").trim()

    rules.push({ globs: always ? null : globs, content, path: file })
    log(`Loaded: ${file} ${always ? "(always)" : `(applyTo: ${globs.join(", ")})`}`)
  }

  const alwaysCount = rules.filter((r) => r.globs === null).length
  const conditionalCount = rules.filter((r) => r.globs !== null).length
  log(`Total: ${rules.length} rules (${alwaysCount} always, ${conditionalCount} conditional)`)

  return rules
}

export const CopilotInstructionsPlugin: Plugin = async ({
  directory,
  client,
}: PluginInput) => {
  const rules = await loadRules(directory)

  return {
    tool: {
      list_injected_copilot_instructions: tool({
        description:
          "List which .github/instructions files have been injected into the current session's system prompt, and which are still pending (waiting for a matching file to be read/edited).",
        args: {},
        async execute(_args, ctx) {
          const state = sessions.get(ctx.sessionID)
          const injected = state ? Array.from(state.injectedRules) : []
          const contextPaths = state ? Array.from(state.contextPaths) : []

          const alwaysRules = rules.filter((r) => r.globs === null)
          const conditionalRules = rules.filter((r) => r.globs !== null)
          const injectedConditional = conditionalRules.filter((r) =>
            injected.includes(r.path)
          )
          const pendingConditional = conditionalRules.filter(
            (r) => !injected.includes(r.path)
          )

          const lines: string[] = [
            `## Copilot Instructions Status`,
            ``,
            `### Always-active (no applyTo) — ${alwaysRules.length} files`,
            ...alwaysRules.map(
              (r) => `- ${injected.includes(r.path) ? "✓" : "○"} ${r.path}`
            ),
            ``,
            `### Conditional (applyTo) — ${conditionalRules.length} files`,
            `Injected (${injectedConditional.length}):`,
            ...injectedConditional.map(
              (r) => `- ✓ ${r.path} [${r.globs!.join(", ")}]`
            ),
            `Pending (${pendingConditional.length}):`,
            ...pendingConditional.map(
              (r) => `- ○ ${r.path} [${r.globs!.join(", ")}]`
            ),
            ``,
            `### Context paths seen this session (${contextPaths.length})`,
            ...contextPaths.map((p) => `- ${p}`),
          ]

          return lines.join("\n")
        },
      }),
    },

    "tool.execute.before": async (input, output) => {
      const { tool: toolName, sessionID } = input
      if (!sessionID) return

      if (!["read", "edit", "write"].includes(toolName)) return

      const args = (output as { args?: Record<string, unknown> }).args
      const filePath = args?.filePath
      if (typeof filePath !== "string" || !filePath) return

      const rel = relative(directory, filePath)
      const isNew = !getSession(sessionID).contextPaths.has(rel)
      getSession(sessionID).contextPaths.add(rel)
      if (isNew) log(`New context path: ${rel} (session ${sessionID.slice(0, 8)})`)
    },

    "experimental.chat.system.transform": async (input, output) => {
      const sessionID = input?.sessionID
      if (!sessionID) return

      const state = getSession(sessionID)
      const toInject: string[] = []

      for (const rule of rules) {
        if (state.injectedRules.has(rule.path)) continue

        const matches =
          rule.globs === null
            ? true
            : state.contextPaths.size > 0 &&
            Array.from(state.contextPaths).some((p) =>
              rule.globs!.some((g) => matchesGlob(p, g))
            )

        if (matches) {
          toInject.push(rule.content)
          state.injectedRules.add(rule.path)
          log(`Injected: ${rule.path} into session ${sessionID.slice(0, 8)}`)
        }
      }

      if (toInject.length > 0) {
        output.system.push(...toInject)

        const names = rules
          .filter((r) => toInject.includes(r.content))
          .map((r) => r.path.replace(".instructions.md", ""))

        try {
          await (client as any).tui.showToast({
            body: {
              title: "📖 Copilot Instructions",
              message: `Loaded: ${names.join(", ")}`,
              variant: "info",
              duration: 3000,
            },
          })
        } catch {
          // tui not available in non-interactive mode
        }
      }
    },

    "experimental.session.compacting": async (input, output) => {
      const { sessionID } = input
      if (!sessionID) return

      const state = sessions.get(sessionID)
      if (!state || state.contextPaths.size === 0) return

      const sanitize = (p: string) =>
        p.replace(/[\r\n\t]/g, " ").slice(0, 300)

      const paths = Array.from(state.contextPaths).sort().slice(0, 20)
      const extra = state.contextPaths.size - paths.length

      output.context.push(
        [
          "Copilot Instructions context paths:",
          ...paths.map((p) => `  - ${sanitize(p)}`),
          ...(extra > 0 ? [`  ... and ${extra} more paths`] : []),
        ].join("\n")
      )

      // Reset after compaction so instructions are re-evaluated
      state.injectedRules.clear()
      log(`Compaction: cleared injected rules for session ${sessionID.slice(0, 8)}`)
    },
  }
}

const id = "opencode-copilot-instructions" as const
const server = CopilotInstructionsPlugin satisfies Plugin
export default { id, server }
