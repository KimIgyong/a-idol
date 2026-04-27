---
description: Run unit tests across the workspace
argument-hint: <optional filter>
---

Run tests:

```
pnpm test $ARGUMENTS
```

If `$ARGUMENTS` is empty, run all tests. Otherwise pass `$ARGUMENTS` as a Jest name filter (e.g., `identity` to run only identity tests).

After tests finish:
- If there are failures, read the failing spec, understand the invariant that was violated, and propose a minimal fix.
- If coverage drops below 70% for use cases, suggest what unit tests to add next (match to WBS TestCases: TC-001..TC-055).

Never modify tests to make them pass — fix the production code instead, or report that the expectation itself is wrong and ask the user.
