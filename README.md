# @manuelvanrijn/opencode-copilot-instructions

[![npm version](https://img.shields.io/npm/v/@manuelvanrijn/opencode-copilot-instructions)](https://www.npmjs.com/package/@manuelvanrijn/opencode-copilot-instructions)

An [OpenCode](https://opencode.ai) plugin that loads `.github/instructions/` files into the AI agent's system prompt — following the same `applyTo:` convention as [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot).

## How it works

- **Files with `applyTo:`** are injected on-demand when the agent reads, edits, or writes a file matching the glob pattern
- **Files without `applyTo:`** are always injected at the start of every session

This means you can keep your existing `.github/instructions/` setup and it works in both Copilot and OpenCode without any duplication.

## Installation

```bash
opencode plugin @manuelvanrijn/opencode-copilot-instructions --global
```

Or add it to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@manuelvanrijn/opencode-copilot-instructions"]
}
```

## Instruction file format

Same format as GitHub Copilot — YAML frontmatter with `applyTo:`:

```markdown
---
applyTo: "app/controllers/**"
---
# Controllers Guide

Your instructions here...
```

Multiple globs (comma-separated):

```markdown
---
applyTo: "app/models/**, test/**"
---
# Models
```

No frontmatter = always active:

```markdown
# General Rails Guidelines

Always use...
```

## Debugging

Enable verbose logging:

```bash
COPILOT_INSTRUCTIONS_DEBUG=1 opencode
```

## Tool: `list_injected_copilot_instructions`

The plugin exposes a tool the agent can call to report the current injection status:

```
list_injected_copilot_instructions
```

Output shows which files are injected, which are pending, and which file paths have been seen in the session.

## Releasing

Publishing to npm is fully automated via `.github/workflows/publish.yml`, triggered by pushing a `v*.*.*` tag.

From a clean `main`:

```bash
git switch main && git pull
npm version patch   # or: minor | major
git push --follow-tags
```

`npm version` bumps `package.json` + `package-lock.json`, creates a commit and annotated tag `vX.Y.Z`. The tag push triggers the workflow, which:

1. Verifies the tag matches `package.json` version.
2. Creates a GitHub Release with auto-generated notes.
3. Publishes to npm with `--provenance` (OIDC / sigstore).

## License

MIT
