# Changelog

## Unreleased

### Added
- `chat.message` hook that extracts file paths from user message text via regex, enabling same-turn injection when a user mentions a file path without the agent needing to call a tool first.
- Regex path extractor (`extractPathsFromText`) that picks up paths like `apps/joblab/app/controllers/foo.rb` directly from message text, excluding URLs and bare words.

### Changed
- Replaced permanent session-level `injectedRules` deduplication with a per-turn `rulesInjected` guard. Rules are now re-evaluated every turn, so newly matched paths trigger injection immediately rather than being skipped because a rule was "already seen" this session.
- `experimental.chat.messages.transform` now also seeds paths from text parts in message history, not just tool call args.
- `tool.execute.before` now also captures `glob` and `grep` tool paths, not just `read/edit/write`.
- After compaction, `seededFromHistory` is reset so the next turn re-seeds from the compacted history.
- `list_injected_copilot_instructions` output simplified: shows active (matching) vs pending (no match yet) based on current `contextPaths`.


## v0.1.1 — 2026-04-24

### Changed

- Injected instructions are now wrapped in `<project_instructions>` XML tags with an explicit directive to follow them immediately. This gives the model a clear signal that the content is authoritative project guidance rather than passive context.
- Always-active rules (no `applyTo`) are injected as `type="always"`, conditional rules (with `applyTo`) as `type="conditional"`.
- Injection order preserved: base system prompt first, always rules second, conditional rules last — all via `push`.
