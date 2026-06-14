# AI Workflow

This project uses two AI coding assistants:

## Claude Code

Claude is responsible for:
- understanding the product idea
- planning the architecture
- creating implementation tickets
- reviewing Codex diffs
- checking bugs, security risks, edge cases, and breaking changes

Claude should not:
- merge PRs
- deploy production
- change secrets
- implement large changes without approval

## Codex

Codex is responsible for:
- implementing one ticket at a time
- creating focused diffs
- adding tests
- updating docs
- preparing PRs

Codex should not:
- make architecture decisions alone
- expand scope
- merge PRs
- deploy
- change secrets

## Workflow

1. User writes or updates `docs/project-brief.md`
2. Claude creates architecture plan
3. Claude breaks work into tickets
4. Codex implements one ticket per branch
5. Codex opens PR or prepares diff
6. Claude reviews the diff
7. User decides whether to merge