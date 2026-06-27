# Idetik

A layer-based library for interactive visualization of large bioimaging data, with first-class support for OME-Zarr.

## Project Status

This project is under active development and not yet stable. We welcome bug reports and new ideas, but are not prepared to review or accept major contributions at this time.

## Reporting Security Issues

If you believe you have found a security issue, please responsibly disclose via the process in our [Security Policy](SECURITY.md).

## Getting started (development)

1. Install the development version of node.

   If you use `nvm` to manage node versions, you can run:

   `nvm use`

   Otherwise, manually install the version of node specified in `.nvmrc`.

2. Install the dependencies required by this project (from within this directory):

   `npm install`

   Re-run this command any time the dependencies listed in [package.json](package.json) change, such
   as after checking out a different revision or pulling changes.

3. To run a local server for development purposes (from the repo root):

   `npm run examples`

   This will start a server on <http://localhost:5173>. The examples under [examples/](examples/)
   are for local development and testing only; they are not deployed.

4. To run the unit test suite (headless Chrome using playwright), run:

   `npm test` or `npm run test-with-coverage` to generate a coverage report.

   By default, the test runner will watch for changes to the source files and re-run the tests
   automatically, so you can leave it running while you work. To run the tests once and exit, use
   `npm run test -- --run`.

5. To build the library for publishing:

   `npm run build`

   This bundles the library and emits type declarations to `dist/`. Use `npm run compile` to
   type-check and emit declarations only (no bundle).

6. To build the examples as a static site (e.g. to verify the production build):

   `npm run build:examples`

   Output is written to `examples/dist/`.

7. To work on the documentation site:

   - `npm run docs:dev` — start the VitePress dev server on <http://localhost:5174>
   - `npm run docs:build` — build the static docs site to `.vitepress/dist/` (also generates the
     API reference from TypeScript/JSDoc via TypeDoc)
   - `npm run docs:preview` — build, then locally serve the production docs

   The docs site is deployed to GitHub Pages automatically on push to `main`.

8. See [package.json](package.json) for other available commands.

## Release

We maintain the [@idetik/core](https://www.npmjs.com/package/@idetik/core?activeTab=readme) package on npm.

### Automatic Release Process (Recommended)

We use [semantic-release](https://github.com/semantic-release/semantic-release) to automatically handle versioning, changelog generation, npm publishing, and GitHub releases.

#### How It Works

1. **Use Conventional Commits**: When creating PRs, ensure your PR title follows the [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat: add new feature` → triggers a **minor** version bump (e.g., 0.1.0 → 0.2.0)
   - `fix: resolve bug` → triggers a **patch** version bump (e.g., 0.1.0 → 0.1.1)
   - `feat!: breaking change` or `BREAKING CHANGE:` in commit footer → triggers a **minor** version bump while in `0.x` (e.g., 0.1.0 → 0.2.0)
   - `refactor:`, `perf:`, `chore:`, `revert:` → triggers a **patch** version bump
   - `docs:`, `style:`, `test:`, `ci:`, `build:` → no release

   While the project is in `0.x`, breaking changes bump the **minor** version (see [.releaserc.json](.releaserc.json)); `1.0.0` will be cut deliberately.

2. **PR Title Validation**: Our CI automatically validates PR titles to ensure they follow the conventional commit format.

3. **Merge to Main**: When your PR is merged to `main`, the release workflow automatically:
   - Analyzes commits since the last release
   - Determines the version bump
   - Updates the version in `package.json`
   - Generates/updates `CHANGELOG.md`
   - Publishes to npm as `@idetik/core`
   - Creates a GitHub release with release notes
   - Tags the release (e.g., `v0.2.0`)

4. **No Manual Intervention Required**: The entire process is automatic once merged to `main`.

#### Pre-requirements

- For GH Actions:
    - Set up "trusted publishing" for the repo/package pair on npm (uses OIDC to authenticate when publishing)
    - Use `actions/create-github-app-token` to generate a GH token so `semantic-release` can comment
      on the PR after release
- For manual releases:
    - Set `NPM_TOKEN` env var with an npm token with publish access to `@idetik` scope
    - You must be a member of the [idetik developer team](https://www.npmjs.com/settings/idetik/teams/team/developers/users) on NPM

### Manual Release Process (Fallback)

If you need to manually release (e.g., if the automated process fails), follow these steps:

1. **Bump the version**:
   ```shell
   git switch -c your-name/prerelease-X-Y-Z
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

## Code of Conduct

This project adheres to the Contributor Covenant [code of conduct](https://www.contributor-covenant.org/version/3/0/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to opensource@chanzuckerberg.com.
