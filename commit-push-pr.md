# Commit-Push-PR Workflow

Quick workflow for creating feature branches, committing, and making PRs.

## Usage
```bash
# 1. Create feature branch
git checkout -b feature/issue-{number}-{brief-name}

# 2. Stage and commit
git add .
git commit -m "feat: {Brief description} (#{issue-number})

- {Main change}
- {Secondary change}
- {Technical detail}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. Push branch
git push -u origin feature/issue-{number}-{brief-name}

# 4. Create PR
gh pr create --title "feat: {Brief description} (#{issue-number})" --body "## Summary
{What this PR does}

## Changes
- {Change 1}
- {Change 2} 
- {Change 3}

## Test plan
- [ ] {Test item}
- [ ] Mobile responsive
- [ ] No errors

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Commit Types
- `feat:` - New features
- `fix:` - Bug fixes  
- `refactor:` - Code improvements
- `style:` - UI changes

## Example
```bash
git checkout -b feature/issue-12-week-navigation
git add .
git commit -m "feat: Enhanced week navigation visibility (#12)"
git push -u origin feature/issue-12-week-navigation
gh pr create --title "feat: Enhanced week navigation visibility (#12)"
```