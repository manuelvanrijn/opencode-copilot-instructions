# @manuelvanrijn/copilot-instructions-plugin

[![npm version](https://img.shields.io/npm/v/@manuelvanrijn/copilot-instructions-plugin)](https://www.npmjs.com/package/@manuelvanrijn/copilot-instructions-plugin)

A **Claude Code** plugin that loads `.github/instructions/` files into the AI agent's system prompt — following the same `applyTo:` convention as [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot).

Also works in **Factory Droid** and **OpenCode**.

## How it works

- **`.github/copilot-instructions.md`** is always injected if it exists — this is the repository-level instructions file used by GitHub Copilot
- **Files with `applyTo:`** are injected on-demand when the agent reads, edits, or writes a file matching the glob pattern
- **Files without `applyTo:`** are always injected at the start of every session

This means you can keep your existing `.github/copilot-instructions.md` and `.github/instructions/` setup and it works in Copilot, Claude, Droid, and OpenCode without any duplication.

## Installation

### Claude Code

**Local development:**

```bash
claude --plugin-dir /path/to/this/repo
```

**Install from GitHub:**

```bash
claude --plugin-url https://github.com/manuelvanrijn/copilot-instructions-plugin
```

Then run `/reload-plugins` to activate.

### Factory Droid

Factory Droid has [native Claude Code compatibility](https://docs.factory.ai/cli/configuration/plugins#claude-code-compatibility). Install the plugin the same way as in Claude Code:

```bash
droid plugin install /path/to/this/repo
```

Or add the repo to your Droid marketplaces and install from there. Droid will read the `.claude-plugin/` manifest and hooks directly.

### OpenCode

```bash
opencode plugin @manuelvanrijn/copilot-instructions-plugin@0.1.2 --global
```

Or add it to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@manuelvanrijn/copilot-instructions-plugin@0.1.2"]
}
```

## Compatibility

All platforms read from the same instruction sources:

| Platform | Source files | Conditional `applyTo:` | Always-active |
|----------|-------------|------------------------|---------------|
| Claude Code | `.github/copilot-instructions.md`, `.github/instructions/*.md` | Via plugin hooks | Yes |
| Factory Droid | `.github/copilot-instructions.md`, `.github/instructions/*.md` | Via Claude-compatible hooks | Yes |
| OpenCode | `.github/copilot-instructions.md`, `.github/instructions/*.md` | Via OpenCode plugin API | Yes |

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

Use the release script from a clean `main`:

```bash
git switch main && git pull
./scripts/release.sh patch   # or: minor | major
```

The script:

1. Verifies the working tree is clean.
2. Bumps the version in `package.json` (`npm version --no-git-tag-version`).
3. Syncs the version to `.claude-plugin/plugin.json`.
4. Updates `CHANGELOG.md`: renames `## Unreleased` to `## vX.Y.Z — YYYY-MM-DD` and adds a fresh `## Unreleased` section at the top.
5. Updates version references in `README.md`.
6. Commits (`chore: release vX.Y.Z`), creates tag `vX.Y.Z`, and pushes both to `origin/main`.

The tag push then triggers the GitHub Actions workflow, which:

1. Verifies the tag matches `package.json` version.
2. Creates a GitHub Release with auto-generated notes.
3. Publishes to npm with `--provenance` (OIDC / sigstore).

## License

MIT
