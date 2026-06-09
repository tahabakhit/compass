# Token Economics Methodology

This document explains how the harness estimates tokens saved by each automated system.
All figures are estimates based on observed intervention costs — not exact measurements.

---

## Routing Savings

**Metric:** Tier 0-2 resolutions
**Formula:** `resolutions * 500 tokens`
**Rationale:** A Tier 3 resolution (full Claude Code context load + multi-turn reasoning) costs
roughly 500 tokens on average. When the router resolves a request at Tier 0 (cache hit), Tier 1
(skill match), or Tier 2 (lightweight agent), that cost is avoided entirely. The tier value must
be present in `meta.tier` of an `agent-runs.jsonl` entry for this to be counted.

---

## Circuit Breaker Savings

**Metric:** Total circuit trips
**Formula:** `trips * 15,000 tokens`
**Rationale:** A "spiral" — where an agent loops on a failing task without intervention — typically
consumes 10,000-20,000 tokens before a human notices and stops it. The circuit breaker trips when
repeated failures are detected and halts execution early. 15,000 tokens is the midpoint estimate
for a stopped spiral. Trips are counted from `hook-timing.jsonl` entries with
`hook: circuit-breaker, metric: trips` and from `audit.jsonl` entries with circuit-breaker trip
events.

---

## Quality Gate Savings

**Metric:** Violations caught
**Formula:** `violations * 8,000 tokens`
**Rationale:** When a quality gate catches a violation at commit/tool-use time, it prevents a
downstream "fix session" where an agent or human debugs and corrects the problem. Fix sessions
for typical quality issues (type errors, missing cleanup, broken tests) average roughly 8,000
tokens. Violations are counted from `hook-timing.jsonl` entries with
`hook: quality-gate, metric: violations` and from `audit.jsonl` entries containing violation
events.

---

## Total Estimated Savings

Sum of all three estimates above. No double-counting — each system tracks distinct intervention
points.

---

*These estimates are conservative and intended as directional signals, not billing figures.
Run `node scripts/telemetry-report.cjs --tokens` to see the current totals.*
