# @idetik/core-prerelease

🚨 **This package is under active development.** Use at your own risk in production environments.

A layer-based visualization abstraction for interactive rendering of large datasets, with particular focus on scientific imaging and bioinformatics data formats.

## Installation

```bash
npm install @idetik/core-prerelease
```

## Releasing

This package is automatically released using [semantic-release](https://github.com/semantic-release/semantic-release).

### Automatic Releases

When PRs are merged to `main` with conventional commit messages, a new version is automatically:
- Versioned based on commit types (`feat`, `fix`, `BREAKING CHANGE`, etc.)
- Published to npm
- Tagged in GitHub with release notes
- Documented in the auto-generated CHANGELOG.md

See the [root README](../../README.md#release) for complete release documentation.
