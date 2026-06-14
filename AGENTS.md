# AGENTS.md

## Role

You are the implementation agent for this project.

Claude Code is the planner and reviewer.
You should implement only clearly scoped tickets.

## Working Rules

- Work on one ticket at a time.
- Keep diffs small and focused.
- Do not add features that are not in the ticket.
- Do not refactor unrelated files.
- Do not change architecture unless the ticket explicitly says so.
- Do not modify secrets, credentials, .env files, billing, auth permissions, or deployment settings unless explicitly approved.
- Add or update tests when behavior changes.
- Update docs if user-facing behavior changes.

## Git Rules

Use one branch per ticket.

Branch format:

ai/<ticket-number>-short-name

Examples:

ai/001-project-scaffold
ai/002-auth-api
ai/003-dashboard-ui
ai/004-tests
ai/005-docs

## Commit Rules

Commit message format:

type: short summary

Examples:

feat: add project scaffold
fix: handle empty input
test: add auth validation tests
docs: update setup guide

## PR Rules

Each PR must include:

- Summary
- Ticket link or ticket name
- Files changed
- Tests run
- Risks and edge cases
- Screenshots if UI changed

## Done Means

- Ticket acceptance criteria are complete.
- Tests pass or failures are explained.
- Diff is small.
- No unrelated changes.
- PR summary is clear.