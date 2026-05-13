import { InstructionEngine, createEngineState } from "../../core/engine.js"
import {
  getCacheDir,
  loadState,
  saveState,
  type DroidPersistedState,
} from "../state.js"
import { readStdin } from "./_stdin.js"

function isStatusQuery(prompt: string): boolean {
  return /^.*(?=.*(?:instruction|copilot)).*(?:status|loaded|active|inject|list|show|which|what|current).*$/i.test(prompt)
}

async function main() {
  const input = JSON.parse(await readStdin())
  const sessionID = input.session_id as string
  const projectDir = (input.project_dir ?? input.cwd) as string
  const prompt = (input.prompt as string) ?? ""

  if (!projectDir) {
    console.error("ERROR: project_dir or cwd is missing from hook input")
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

  engine.addPathsFromText(state, prompt, "Path from user prompt")
  state.rulesInjected = false

  const instructions = engine.renderInstructions(state)
  const matchedConditional = engine.getMatchedConditionalRules(state)

  const newPersisted: DroidPersistedState = {
    contextPaths: Array.from(state.contextPaths),
    seededFromHistory: state.seededFromHistory,
    rulesInjected: true,
    lastMatchCount: matchedConditional.length,
    lastMatchedConditionalPaths: matchedConditional.map((r) => r.path),
    version: 1,
    compactSummary: persisted.compactSummary,
  }

  await saveState(cacheDir, sessionID, newPersisted)

  const additionalContext: Array<{ type: string; text: string }> = []

  if (isStatusQuery(prompt)) {
    additionalContext.push({
      type: "text",
      text: engine.renderStatus(state),
    })
  }

  if (instructions.length > 0) {
    for (const text of instructions) {
      additionalContext.push({ type: "text", text })
    }
  }

  if (additionalContext.length === 0) {
    console.log(JSON.stringify({}))
    return
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        additionalContext,
      },
    })
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
