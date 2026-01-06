# PR

Run a pre-PR quality gate and create a pull request.

## Steps

1. **Build check**: Run `npm run build` — fix any errors before proceeding.
2. **Type check**: Astro's build includes TypeScript checking; if you need an explicit check run `npx astro check`.
3. **Lint**: Run `npx eslint src/` and fix any reported issues.
4. **Review staged changes**: Run `git diff main...HEAD` to review all commits.
5. **Create PR**: Use `gh pr create` with a clear title and summary of changes.

## PR body template

```
## Summary
- <bullet points describing what changed>

## Test plan
- [ ] `npm run build` passes
- [ ] `astro check` passes with no type errors
- [ ] Visual review of affected pages in `npm run preview`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
