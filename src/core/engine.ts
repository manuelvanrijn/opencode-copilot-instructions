import { join } from "node:path"

import { loadRules, type InstructionRule } from "../instructions.js"
import { extractPathsFromText, normalizeContextPath, extractToolOutputText } from "../paths.js"
import {
  conditionalRuleCount,
  matchingRules,
  renderInjectedInstructions,
  renderInstructionStatus,
} from "../rules.js"

export interface EngineState {
  contextPaths: Set<string>
  seededFromHistory: boolean
  rulesInjected: boolean
  lastMatchCount: number
  lastMatchedConditionalPaths: string[]
}

export function createEngineState(): EngineState {
  return {
    contextPaths: new Set(),
    seededFromHistory: false,
    rulesInjected: false,
    lastMatchCount: 0,
    lastMatchedConditionalPaths: [],
  }
}

export class InstructionEngine {
  readonly rules: InstructionRule[]
  readonly directory: string
  private log: (...args: unknown[]) => void

  constructor(
    rules: InstructionRule[],
    directory: string,
    log: (...args: unknown[]) => void = () => {}
  ) {
    this.rules = rules
    this.directory = directory
    this.log = log
  }

  static async create(
    directory: string,
    log?: (...args: unknown[]) => void
  ): Promise<InstructionEngine> {
    const rules = await loadRules(directory, log)
    return new InstructionEngine(rules, directory, log)
  }

  addPath(state: EngineState, filePath: string, source?: string): string | null {
    const rel = normalizeContextPath(this.directory, filePath)
    if (!rel || state.contextPaths.has(rel)) return null
    state.contextPaths.add(rel)
    if (source) this.log(`${source}: ${rel}`)
    return rel
  }

  addPathsFromText(state: EngineState, text: string, source?: string): string[] {
    const added: string[] = []
    for (const found of extractPathsFromText(text)) {
      if (this.addPath(state, found, source)) added.push(found)
    }
    return added
  }

  addPathsFromToolInput(
    state: EngineState,
    toolName: string,
    args: Record<string, unknown>
  ): string[] {
    const added: string[] = []

    if (toolName === "bash") {
      const workdir = args?.workdir
      if (typeof workdir === "string" && workdir) {
        const rel = this.addPath(state, workdir, "New context path")
        if (rel) added.push(rel)
      }

      const command = args?.command
      if (typeof command === "string") {
        const cdTarget =
          command.match(/(?:^|&&|\s)cd\s+([^\s&|;]+)/)?.[1] ?? null
        const effectiveWorkdir =
          typeof workdir === "string" && workdir ? workdir : cdTarget

        for (const found of extractPathsFromText(command)) {
          const rel = this.addPath(state, found, "New context path")
          if (rel) {
            added.push(rel)
            if (
              effectiveWorkdir &&
              !found.startsWith("/") &&
              !found.startsWith(".")
            ) {
              const rel2 = this.addPath(
                state,
                join(effectiveWorkdir, found),
                "New context path"
              )
              if (rel2) added.push(rel2)
            }
          }
        }
      }
    } else if (["read", "edit", "write", "glob", "grep"].includes(toolName)) {
      const filePath = (args?.filePath ?? args?.path) as string | undefined
      if (typeof filePath === "string" && filePath) {
        const rel = this.addPath(state, filePath, "New context path")
        if (rel) added.push(rel)
      }
    }

    return added
  }

  addPathsFromToolOutput(
    state: EngineState,
    toolName: string,
    output: unknown
  ): string[] {
    if (!["bash", "glob", "grep"].includes(toolName)) return []
    const text = extractToolOutputText(output)
    if (!text) return []
    return this.addPathsFromText(
      state,
      text,
      `New context path from ${toolName} output`
    )
  }

  seedFromHistory(
    state: EngineState,
    messages: Array<{ parts: Array<Record<string, unknown>> }>,
    sessionID: string
  ): string[] {
    if (state.seededFromHistory) return []
    const added: string[] = []

    for (const message of messages) {
      for (const part of message.parts) {
        const p = part as Record<string, unknown>
        if (p["sessionID"] !== sessionID) continue

        if (p["type"] === "tool") {
          const toolState = p["state"] as
            | Record<string, unknown>
            | undefined
          const toolInput = toolState?.["input"] as
            | Record<string, unknown>
            | undefined
          const filePath = toolInput?.["filePath"] ?? toolInput?.["path"]
          if (typeof filePath === "string" && filePath) {
            const rel = this.addPath(state, filePath, "Seeded from history (tool)")
            if (rel) added.push(rel)
          }
        } else if (p["type"] === "text") {
          const text = p["text"]
          if (typeof text === "string") {
            const newPaths = this.addPathsFromText(
              state,
              text,
              "Seeded from history (text)"
            )
            added.push(...newPaths)
          }
        }
      }
    }

    state.seededFromHistory = true
    return added
  }

  renderInstructions(state: EngineState): string[] {
    const matched = matchingRules(this.rules, state.contextPaths)
    return renderInjectedInstructions(matched)
  }

  getConditionalMatchCount(state: EngineState): number {
    const matched = matchingRules(this.rules, state.contextPaths)
    return conditionalRuleCount(matched)
  }

  getMatchedConditionalRules(state: EngineState): InstructionRule[] {
    const matched = matchingRules(this.rules, state.contextPaths)
    return matched.filter((r) => r.globs !== null)
  }

  renderStatus(state: EngineState): string {
    return renderInstructionStatus(this.rules, Array.from(state.contextPaths))
  }

  buildCompactionSummary(state: EngineState): string {
    const sanitize = (path: string) => path.replace(/[\r\n\t]/g, " ").slice(0, 300)
    const paths = Array.from(state.contextPaths).sort().slice(0, 20)
    const extra = state.contextPaths.size - paths.length
    return [
      "Copilot Instructions context paths:",
      ...paths.map((path) => `  - ${sanitize(path)}`),
      ...(extra > 0 ? [`  ... and ${extra} more paths`] : []),
    ].join("\n")
  }
}
