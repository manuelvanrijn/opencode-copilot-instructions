import { readFile } from "node:fs/promises"
import { createEmptyState, type DroidPersistedState } from "./state.js"

/**
 * Rebuild state from a Droid transcript file.
 *
 * MVP: returns empty state because transcript format is not yet stable.
 * Future: parse transcript JSONL and replay path extraction.
 */
export async function rebuildStateFromTranscript(
  _transcriptPath: string
): Promise<DroidPersistedState> {
  try {
    // Placeholder: if we ever need to read the transcript, do it here.
    await readFile(_transcriptPath, "utf8")
  } catch {
    // transcript missing or unreadable
  }
  return createEmptyState()
}
