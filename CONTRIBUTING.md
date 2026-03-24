# Contributing to idetik

Thank you for your interest in contributing to idetik!

This project is under active development and not yet stable. We welcome bug reports and new ideas, but are not prepared to review or accept major contributions at this time.

## Getting Started

### Development Setup

1. Install the development version of node (see `.nvmrc` for the required version):
   ```bash
   nvm use
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the local development server:
   ```bash
   npm run examples
   ```
   This will start a server on <http://localhost:5173>.

4. Run tests:
   ```bash
   npm test
   ```

For more detailed setup instructions, see the [README](README.md#getting-started).

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub and include:
- A clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, browser, version)

### Suggesting Features

If you have an idea for a new feature, please create a GitHub issue with:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

Please understand that your feature request may not align with our current priorities, but we will
consider any feedback in future planning.

## Code Style

We use automated formatting and linting:
- **Formatting**: Prettier (run `npm run format` to auto-format)
- **Linting**: ESLint (run `npm run lint` to check)

Before submitting a PR, ensure both pass:
```bash
npm run format
npm run lint
```

## Testing

All code changes should include tests. We use Vitest for testing:
```bash
npm test                    # Run tests in watch mode
npm run test-with-coverage  # Run tests with coverage report
```

## Release Process

We use [semantic-release](https://github.com/semantic-release/semantic-release) to automatically handle versioning and publishing. When your PR is merged to `main`, the release process:
- Analyzes your commit messages
- Determines the version bump
- Updates the changelog
- Publishes to npm
- Creates a GitHub release

This process relies on using conventional commits in PR titles (we use squash-and-merge).

## Security Issues

If you discover a security vulnerability, please report it privately. See our [Security Policy](SECURITY.md) for details on how to report security issues.

## Code of Conduct

This project adheres to the Contributor Covenant [code of conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to opensource@chanzuckerberg.com.

## License

By contributing to idetik, you agree that your contributions will be licensed under the MIT License.
