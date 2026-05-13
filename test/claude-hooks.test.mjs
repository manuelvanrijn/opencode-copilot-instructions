import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, mkdir, writeFile, rmdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

function runHook(scriptPath, stdinObj) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (d) => (stdout += d))
    proc.stderr.on("data", (d) => (stderr += d))
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`Exit ${code}: ${stderr}`))
      else resolve({ stdout, stderr })
    })
    proc.stdin.write(JSON.stringify(stdinObj))
    proc.stdin.end()
  })
}

async function createProject(files) {
  const directory = await mkdtemp(join(tmpdir(), "claude-hooks-"))
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(directory, path)
    await mkdir(join(fullPath, ".."), { recursive: true })
    await writeFile(fullPath, content)
  }
  return directory
}

const HOOKS_DIR = join(process.cwd(), "dist/src/claude/hooks")

test("session-start emits compact summary when source=compact", async () => {
  const directory = await createProject({
    ".github/instructions/general.md": "# General\n\nAlways.",
  })

  // Run user prompt then compact to generate a summary
  await runHook(join(HOOKS_DIR, "user-prompt-submit.js"), {
    session_id: "sess-1",
    project_dir: directory,
    prompt: "Hello",
  })

  await runHook(join(HOOKS_DIR, "pre-compact.js"), {
    session_id: "sess-1",
    project_dir: directory,
  })

  const { stdout } = await runHook(join(HOOKS_DIR, "session-start.js"), {
    session_id: "sess-1",
    project_dir: directory,
    source: "compact",
    transcript_path: join(directory, "transcript.json"),
  })

  assert.match(stdout, /Copilot Instructions context paths/)
})

test("session-start emits resume message with context paths", async () => {
  const directory = await createProject({
    ".github/instructions/general.md": "# General\n\nAlways.",
  })

  // Prime state via user-prompt-submit
  await runHook(join(HOOKS_DIR, "user-prompt-submit.js"), {
    session_id: "sess-2",
    project_dir: directory,
    prompt: "Check src/index.ts",
  })

  const { stdout } = await runHook(join(HOOKS_DIR, "session-start.js"), {
    session_id: "sess-2",
    project_dir: directory,
    source: "new",
  })

  assert.match(stdout, /resumed with/)
})

test("user-prompt-submit injects matching conditional rules", async () => {
  const directory = await createProject({
    ".github/instructions/typescript.md": `---\napplyTo: "src/**/*.ts"\n---\n# TS\n\nStrict.`,
  })

  const { stdout } = await runHook(join(HOOKS_DIR, "user-prompt-submit.js"), {
    session_id: "sess-3",
    project_dir: directory,
    prompt: "Please inspect ./src/index.ts.",
  })

  const output = JSON.parse(stdout)
  assert.ok(output.hookSpecificOutput?.additionalContext)
  const texts = output.hookSpecificOutput.additionalContext.map((c) => c.text)
  assert.ok(texts.some((t) => t.includes("Strict.")))
})

test("pre-tool-use captures paths from tool input", async () => {
  const directory = await createProject({
    ".github/instructions/typescript.md": `---\napplyTo: "src/**/*.ts"\n---\n# TS\n\nStrict.`,
  })

  await runHook(join(HOOKS_DIR, "pre-tool-use.js"), {
    session_id: "sess-4",
    project_dir: directory,
    tool: { name: "Read", input: { filePath: "src/index.ts" } },
  })

  const { stdout } = await runHook(join(HOOKS_DIR, "user-prompt-submit.js"), {
    session_id: "sess-4",
    project_dir: directory,
    prompt: "Hello",
  })

  const output = JSON.parse(stdout)
  const texts = output.hookSpecificOutput?.additionalContext?.map((c) => c.text) ?? []
  assert.ok(texts.some((t) => t.includes("Strict.")))
})

test("post-tool-use injects newly active rules after glob output", async () => {
  const directory = await createProject({
    ".github/instructions/typescript.md": `---\napplyTo: "src/**/*.ts"\n---\n# TS\n\nStrict.`,
  })

  // First prompt: no paths, no rules active
  await runHook(join(HOOKS_DIR, "user-prompt-submit.js"), {
    session_id: "sess-5",
    project_dir: directory,
    prompt: "Hello",
  })

  // Glob output discovers a path
  const { stdout } = await runHook(join(HOOKS_DIR, "post-tool-use.js"), {
    session_id: "sess-5",
    project_dir: directory,
    tool: { name: "Glob", output: ["src/index.ts"] },
  })

  const output = JSON.parse(stdout)
  assert.ok(output.hookSpecificOutput?.additionalContext)
  const texts = output.hookSpecificOutput.additionalContext.map((c) => c.text)
  assert.ok(texts.some((t) => t.includes("Strict.")))
})

test("pre-compact persists state and resets injection flags", async () => {
  const directory = await createProject({
    ".github/instructions/general.md": "# General\n\nAlways.",
  })

  // Establish some state
  await runHook(join(HOOKS_DIR, "user-prompt-submit.js"), {
    session_id: "sess-6",
    project_dir: directory,
    prompt: "Hello",
  })

  await runHook(join(HOOKS_DIR, "pre-compact.js"), {
    session_id: "sess-6",
    project_dir: directory,
  })

  // After compact, session-start should emit the summary
  const { stdout } = await runHook(join(HOOKS_DIR, "session-start.js"), {
    session_id: "sess-6",
    project_dir: directory,
    source: "compact",
  })

  assert.match(stdout, /Copilot Instructions context paths/)
})
