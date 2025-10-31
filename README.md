# Project

A layer-based library for interactive visualization of large datasets.

## Getting started

1. Install the dependencies required by this project (from within this directory):

   `npm install`

   Re-run this command any time the dependencies listed in [package.json](package.json) change, such
   as after checking out a different revision or pulling changes.

2. To run a local server for development purposes (from the repo root):

   `npm run examples`

   This will start a server on <http://localhost:5173>.

   You can also run this from the core workspace with:

   `npm run dev`

3. To run the unit test suite on Chrome, from the core workspace run:

   `npm test` or `npm run coverage` to generate a coverage report.

   By default, the test runner will watch for changes to the source files and re-run the tests
   automatically, so you can leave it running while you work. To run the tests once and exit, use
   `npm run test -- --run`.

4. See [package.json](package.json) for other commands available.

## Release

Currently, we maintain the [@idetik/core-prerelease](https://www.npmjs.com/package/@idetik/core-prerelease?activeTab=readme) package on npm.

### Automatic Release Process (Recommended)

We use [semantic-release](https://github.com/semantic-release/semantic-release) to automatically handle versioning, changelog generation, npm publishing, and GitHub releases.

#### How It Works

1. **Use Conventional Commits**: When creating PRs, ensure your PR title follows the [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat: add new feature` → triggers a **minor** version bump (e.g., 7.0.0 → 7.1.0)
   - `fix: resolve bug` → triggers a **patch** version bump (e.g., 7.0.0 → 7.0.1)
   - `feat!: breaking change` or `BREAKING CHANGE:` in commit footer → triggers a **major** version bump (e.g., 7.0.0 → 8.0.0)
   - `refactor:`, `perf:`, `chore:` → triggers a **patch** version bump
   - `docs:`, `style:`, `test:`, `ci:`, `build:` → no release

2. **PR Title Validation**: Our CI automatically validates PR titles to ensure they follow the conventional commit format.

3. **Merge to Main**: When your PR is merged to `main`, the release workflow automatically:
   - Analyzes commits since the last release
   - Determines the version bump
   - Updates the version in `packages/core/package.json`
   - Generates/updates `CHANGELOG.md`
   - Publishes to npm as `@idetik/core-prerelease`
   - Creates a GitHub release with release notes
   - Tags the release (e.g., `v7.1.0`)

4. **No Manual Intervention Required**: The entire process is automatic once merged to `main`.

#### Pre-requirements

- Repository secrets must be configured (already done for this repo):
  - `RELEASE_TOKEN`: GitHub Personal Access Token with repo access
  - `NPM_TOKEN`: npm token with publish access to `@idetik` scope
- You must be a member of the [idetik developer team](https://www.npmjs.com/settings/idetik/teams/team/developers/users) on NPM (for manual releases only)

### Manual Release Process (Fallback)

If you need to manually release (e.g., if the automated process fails), follow these steps:

1. **Bump the version**:
   ```shell
   git switch -c your-name/prerelease-X-Y-Z
   cd packages/core
   npm version [major|minor|patch]  # Choose appropriate bump
   npm install  # Updates package-lock.json
   npm run build
   ```

2. **Create and merge PR**:
   - Create a PR with your changes
   - Get it approved and merge to `main`

3. **Publish to npm**:
   ```shell
   git checkout main
   git pull
   cd packages/core
   npm login
   npm run pub
   ```

4. **Tag the release**:
   ```shell
   git tag vX.Y.Z  # Use the version number from package.json
   git push origin --tags
   ```

5. **Create GitHub release**:
   - Go to the [Releases page](https://github.com/chanzuckerberg/idetik/releases)
   - Click "Create a new release"
   - Select the tag you just created
   - Add release notes describing the changes


