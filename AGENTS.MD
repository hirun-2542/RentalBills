# AGENTS.md

## Role

You are the implementation agent for this repository.

Claude Code is the planner and reviewer.
You should only implement scoped tickets that have clear acceptance criteria.

## Working rules

- Work on one ticket at a time.
- Create a new branch for each ticket.
- Keep diffs small and focused.
- Do not refactor unrelated code.
- Do not change public behavior unless the ticket says so.
- Do not modify secrets, credentials, environment files, or deployment settings unless explicitly requested.
- Add or update tests when behavior changes.
- Update docs when user-facing behavior changes.
- Before finishing, run the relevant lint/test/build commands.

## Git rules

Branch name format:

ai/<ticket-number>-short-description

Commit message format:

<type>: <short summary>

Examples:
feat: add user profile endpoint
fix: handle empty search query
test: add coverage for login validation
docs: update setup guide

## PR rules

PR must include:
- Summary
- Files changed
- Tests run
- Risk / edge cases
- Screenshots if UI changed

## Done means

- Code compiles or builds.
- Tests pass or failure is clearly explained.
- Diff is minimal.
- No unrelated formatting changes.
- PR description is complete.