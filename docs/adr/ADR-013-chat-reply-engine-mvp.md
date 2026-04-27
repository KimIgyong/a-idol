---
id: ADR-013
title: Rule-based chat reply engine for MVP; pluggable port for Phase 2 LLM swap
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-040, T-042]
related_context: Chat
supersedes: []
related_decisions: [ADR-006]
---

## Context

The idol chat (`T-040`) delivers a reply to every user message. The long-term
target is an LLM-powered per-idol persona (ADR-006 is still **pending** on
which provider — Claude or a hosted OSS model). Neither the provider
integration, budget envelope, safety filter, nor per-idol persona prompts are
ready before M3 (2026-07-04). Building any of those into the Chat module
would either block M3 or produce an untested "LLM in the loop" on day one.

We nevertheless need chat to feel responsive from launch so operators can
rehearse the end-to-end product and QA can run scenarios against deterministic
output.

## Decision

MVP ships with a **rule-based reply engine** behind a DI port:

- Port: `IdolReplyEngine` in `packages/backend/src/modules/chat/application/interfaces.ts`.
- Adapter (MVP): `RuleBasedReplyEngine` — picks from an 8-line hand-written
  Korean response pool using `hash(userMessage.length + idolId.last-char) %
  pool.length`. Deterministic per payload, not per user session.
- Adapter (Phase 2): a future `ClaudeReplyEngine` will inject the idol's
  persona JSON (`idol.profileJson` → `coreIdentity` + `deepProfile` +
  `conceptSeed`) as a system prompt and call the Anthropic API.

The **Chat module is unaware** of either adapter. `SendMessageUseCase` and
`DispatchAutoMessageUseCase` both resolve `IdolReplyEngine` by token.
Switching engines is a one-line `provider` change in `ChatModule`.

## Consequences

**Positive**

- Chat works end-to-end on day one with zero external dependencies and zero
  per-message cost. The product can ship through M3 without waiting on LLM
  integration.
- Deterministic responses simplify automated E2E tests: no flakiness from
  model non-determinism or API rate limits.
- ADR-006 (provider choice) can keep running in parallel without blocking
  anything else. When it lands, only one file changes in backend.

**Negative**

- Responses are obviously canned. Early user feedback will flag this; we
  must be explicit in UX copy (and in this ADR) that AI chat is Phase 2.
- The current pool has no per-idol voice — every idol says the same 8 lines.
  The persona-aware LLM replacement is the intended fix; hand-authoring
  per-idol response pools for 99 idols is **not** a path we will take.
- No safety filter. Since responses are all pre-written and benign, this is
  acceptable for MVP. The Phase 2 LLM adapter MUST add content moderation
  (Anthropic built-in safety + project-specific forbidden topics).

## Rejected alternatives

1. **Ship a rough LLM integration for MVP.** Rejected — unbounded cost risk
   (99 idols × daily traffic), no persona tuning, a bad first impression is
   hard to undo, and the provider decision (ADR-006) isn't finalized.

2. **Hard-coded static reply per message.** Rejected — too obviously broken;
   even the 8-line pool preserves some variety and keeps the feature
   demonstrable.

3. **Per-idol response pools authored by the content team.** Rejected at 99
   idols × N lines — maintenance cost is worse than the LLM path and the
   output still feels scripted.

## Activation plan (when ADR-006 lands)

1. Implement `ClaudeReplyEngine` in
   `packages/backend/src/modules/chat/infrastructure/claude-reply-engine.ts`.
2. Build the persona prompt from `idol.profileJson` (`coreIdentity` +
   `conceptSeed.vibe_description` + `deepProfile.personality` if present).
3. Add moderation: reject user messages hitting Anthropic safety filters
   before they reach idol-generated output; log hits for `AdminOps.AuditLog`.
4. Feature-flag at the module level: `provider` conditional on
   `cfg.chatReplyProvider` (`'rules' | 'claude'`). Toggle in staging first.
5. Update `FR-032` acceptance criteria and close this ADR with a new one
   documenting the model/prompt choice.

## Status of implementation

- `IdolReplyEngine` port + `RuleBasedReplyEngine` adapter landed in T-040.
- `SendMessageUseCase` and `DispatchAutoMessageUseCase` both call through
  the port — no static `.pick()` call anywhere in application code.
- Adapter swap verified by unit test (replaced the real adapter with a
  `jest.fn()` returning `'자동 응답'` in
  `send-message.usecase.spec.ts`).
