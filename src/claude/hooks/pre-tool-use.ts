import { InstructionEngine, createEngineState } from "../../core/engine.js"
import {
  getCacheDir,
  loadState,
  saveState,
  type DroidPersistedState,
} from "../state.js"
import { readStdin } from "./_stdin.js"
import { appendFileSync } from "node:fs"

async function main() {
  const rawInput = await readStdin()
  const input = JSON.parse(rawInput)
  
  // DEBUG: log what we received
  appendFileSync("/tmp/copilot-instructions-debug.log", JSON.stringify({
    hook: "pre-tool-use",
    timestamp: new Date().toISOString(),
    input: input
  }, null, 2) + "\n---\n")
  
  const sessionID = input.session_id as string
  const projectDir = input.project_dir as string
  const toolName = (input.tool?.name as string)?.toLowerCase() ?? ""
  const toolInput = (input.tool?.input as Record<string, unknown>) ?? {}

  if (!projectDir) {
    console.error("ERROR: project_dir is missing from hook input")
    console.error("Input keys:", Object.keys(input))
    process.exit(1)
  }

  const cacheDir = getCacheDir(projectDir)
  const persisted = await loadState(cacheDir, sessionID)

  const engine = await InstructionEngine.create(projectDir, () => {})
  const state = createEngineState()
  state.contextPaths = new Set(persisted.contextPaths)
  state.seededFromHistory = persisted.seededFromHistory
  state.rulesInjected = persisted.rulesInjected
  state.lastMatchCount = persisted.lastMatchCount
  state.lastMatchedConditionalPaths = persisted.lastMatchedConditionalPaths

  engine.addPathsFromToolInput(state, toolName, toolInput)

  const newPersisted: DroidPersistedState = {
    contextPaths: Array.from(state.contextPaths),
    seededFromHistory: state.seededFromHistory,
    rulesInjected: state.rulesInjected,
    lastMatchCount: state.lastMatchCount,
    lastMatchedConditionalPaths: state.lastMatchedConditionalPaths,
    version: 1,
    compactSummary: persisted.compactSummary,
  }

  await saveState(cacheDir, sessionID, newPersisted)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
