# Examples

This directory contains worked examples showing how the Citadel harness operates in practice. Each example is a real (or realistic) artifact produced by the system, annotated so you can understand the structure and conventions.

## What's Here

### campaign-example.md

A completed campaign file showing Archon's multi-phase execution model. This example walks through a JWT authentication overhaul broken into 6 phases: research, plan, two build phases, wiring, and verification.

**What it demonstrates:**
- How Archon decomposes a direction into ordered phases
- The Feature Ledger pattern for tracking what was actually built
- Decision Log entries with timestamped reasoning
- Claimed Scope declarations that prevent agent collisions
- Active Context and Continuation State for cross-session persistence

**How to use it:**
1. Read it alongside the Archon skill definition at `skills/archon/SKILL.md`
2. Compare its structure to the campaign template at `.planning/_templates/campaign.md`
3. Use it as a reference when creating your own campaigns — the format is the contract that Archon reads and writes

## Adding New Examples

When adding examples to this directory:
- Use descriptive filenames (e.g., `fleet-parallel-example.md`, not `example2.md`)
- Include enough context that someone unfamiliar with the harness can follow along
- If the example references project-specific files, note which parts are structural (required by the harness) versus domain-specific (particular to that project)
