---
name: self-consistency-reasoner
description: >-
  Use when internal majority-vote reasoning method for high-stakes diagnosis
  and completion verification. Generates independent reasoning paths to catch
  confident but wrong single-chain conclusions.
user-invocable: false
---
# /self-consistency-reasoner — Majority-Vote Reasoning

## Orientation

**Use when:** debugging or verification requires multi-step inference, the answer has a fixed conclusion, and being wrong would cause wasted edits or a false completion claim.
**Don't use when:** a command result directly proves the answer or the task is a tiny mechanical edit.

This imports Superpowers Optimized's self-consistency method as an internal Sinan primitive.

## Protocol

### Step 1 — Decide Path Count

| Problem type | Paths |
|---|---|
| Binary verification: does the evidence prove the claim? | 3 |
| Root cause diagnosis with 2-3 candidates | 5 |
| Complex or high-risk multi-factor diagnosis | 7 |

Default to 5 paths.

### Step 2 — Generate Independent Paths

Reason independently across diverse framings:

- Work forward from observed evidence.
- Work backward from the claimed conclusion.
- Start from a different call stack, data flow, or failure mode.
- For verification, ask separately what the evidence proves, what it does not prove, and what alternative explanation could fit the output.

Each path must end with a clearly parsed final answer.

### Step 3 — Aggregate

Count final answers. The most frequent answer wins.

Confidence:

```text
consistency = paths agreeing with majority / total paths
```

### Step 4 — Act

- `100%`: proceed with high confidence.
- `60-99%`: proceed, but surface the minority view.
- `<=50%`: stop. Gather more evidence or ask the user for the missing assumption.

## Quality Gates

- Paths must use genuinely different starting frames.
- Do not show all private reasoning paths to the user.
- Surface only the final majority verdict, confidence, and minority divergence when relevant.
- Low confidence must block edits or completion claims.

## Fringe Cases

**No fixed answer set:** Do not use this method. Route to `/deliberation`, `/research`, or `/marshal` instead.

**Evidence is missing:** Stop and gather evidence before generating paths.

**Paths scatter across many answers:** The task is ambiguous. Report the top competing conclusions and the assumption that separates them.

## Exit Protocol

```text
---HANDOFF---
- Verdict: <majority answer>
- Confidence: <X/N paths agree>
- Minority view: <brief note or none>
- Action: proceed | gather more evidence | ask user
---
```
