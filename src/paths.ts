import { isAbsolute, join, relative } from "node:path"

// Matches file-like paths in text: optional ./ ../ or /, then word/dot/slash chars
// with at least one slash, excluding URLs.
const PATH_REGEX = /(?:^|[\s"'`(])((\.{0,2}\/)?[\w./-]+\/[\w./-]+(?:\.\w+)?)/gm

/**
 * Extract file-like paths from a text string.
 * Excludes URLs and bare words without slashes.
 */
export function extractPathsFromText(text: string): string[] {
  const found: string[] = []
  let match: RegExpExecArray | null
  PATH_REGEX.lastIndex = 0

  while ((match = PATH_REGEX.exec(text)) !== null) {
    const pathStart = match.index + match[0].indexOf(match[1])
    const pathEnd = pathStart + match[1].length
    const path = match[1].replace(/[.,;:!?]$/, "")
    if (path.includes("://") || path.includes("@") || text[pathEnd] === "@") continue
    found.push(path)
  }

  return found
}

export function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, "/")
}

export function normalizeContextPath(directory: string, filePath: string): string | null {
  const normalizedPath = normalizePathSeparators(filePath.trim())
  if (!normalizedPath) return null

  const absolutePath = isAbsolute(normalizedPath) ? normalizedPath : join(directory, normalizedPath)
  const rel = normalizePathSeparators(relative(directory, absolutePath))

  if (!rel || rel === "." || rel === ".." || rel.startsWith("../") || isAbsolute(rel)) return null
  return rel
}

function collectText(value: unknown, texts: string[]): void {
  if (typeof value === "string") {
    texts.push(value)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectText(item, texts)
    return
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectText(item, texts)
  }
}

export function extractToolOutputText(output: unknown): string {
  const texts: string[] = []
  collectText(output, texts)
  return texts.join("\n")
}
