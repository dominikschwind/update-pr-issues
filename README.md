# update-pr-issues

A GitHub Action that scans commits on a pull request and automatically updates
the PR description with a list of referenced issue numbers.

Recognises these formats in commit messages:
- `#1234`
- `(#1234)`

## Usage

```yaml
name: Update PR Issues

on:
  push:
    branches-ignore:
      - main
      - master
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  update-pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: dominikschwind/update-pr-issues@v1
```

The action adds a managed section to the PR description (preserving any text
you wrote outside it) that looks like:

```
## Referenced Issues

* #1234
* #1235
```

The section is wrapped in HTML comment markers so it can be safely replaced on
every push without touching the rest of the description.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token with `pull-requests:write` permission | No | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `pr-number` | The PR number that was updated |
| `issues-found` | Comma-separated list of issue numbers found (e.g. `1234,1235`) |

## Development

```bash
npm install          # install dependencies
npm test             # run unit tests
npm run build        # bundle into dist/ with ncc
```

The `dist/` folder is committed to the repo and rebuilt automatically by CI on
every push to `main`. Do not edit `dist/` by hand.

### Releasing

```bash
git tag v1.0.0
git push origin v1.0.0

# Move the floating major tag
git tag -f v1
git push origin v1 --force
```
