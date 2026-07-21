# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`; `gh` handles this inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

A bare `#42` may be an issue or PR. Try `gh pr view 42`, then fall back to
`gh issue view 42`.

## Skill operations

- "Publish to the issue tracker" means create a GitHub issue.
- "Fetch the relevant ticket" means run `gh issue view <number> --comments`.
- Wayfinding maps and child tickets use GitHub issues, sub-issues where
  available, native dependencies where available, and task-list fallbacks.
