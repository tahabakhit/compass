# Sinan Identity

Sinan is the product identity for this harness. It is not positioned as a
fork or a Superpowers wrapper.

Sinan keeps the working architecture that was already proven locally:

- `/do` remains the only primary router.
- Specialist skills such as TDD, adversarial review, and completion evidence
  remain explicit-only unless the user asks for them or the router confidently
  selects them.
- Codex and Claude Code integrations should use native runtime primitives for
  plans, checklists, plugin install, hooks, MCP, permissions, automations, and
  PR review whenever those primitives are available.
- Internal compatibility paths such as `.citadel/`, `.planning/`, and the
  `citadel-state` MCP server remain in place for existing initialized projects.
  These are implementation compatibility names, not the public product name.

## Naming Policy

Use `Sinan` for user-facing docs, marketplace names, generated plugin
metadata, install output, readiness reports, and new scripts.

Keep legacy Citadel names only when changing them would break existing project
state or external compatibility. Any remaining legacy name should have a clear
compatibility reason.
