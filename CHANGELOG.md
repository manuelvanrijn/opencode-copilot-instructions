# Changelog

## Unreleased


## v0.1.1 — 2026-04-24

### Changed

- Injected instructions are now wrapped in `<project_instructions>` XML tags with an explicit directive to follow them immediately. This gives the model a clear signal that the content is authoritative project guidance rather than passive context.
- Always-active rules (no `applyTo`) are injected as `type="always"`, conditional rules (with `applyTo`) as `type="conditional"`.
- Injection order preserved: base system prompt first, always rules second, conditional rules last — all via `push`.
