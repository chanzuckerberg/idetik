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

Currently, we maintain Idetik prerelease packages on npm: [@idetik/core-prerelease](https://www.npmjs.com/package/@idetik/core-prerelease?activeTab=readme) and [@idetik/react-prerelease](https://www.npmjs.com/package/@idetik/react-prerelease).

### Pre-requirements

First, you must have cloned this repository and must be able to build the core and react packages.

Second, you must be a member of the [idetik developer team](https://www.npmjs.com/settings/idetik/teams/team/developers/users) on NPM.

### Process

Our release process is currently manual and we currently bump the major version every time to easily avoid unintentional downstream breakage.

To release the core package run the following the commands

```shell
git switch -c your-name/prerelease-X-Y-Z
cd packages/core
npm version major
npm build
```

where `X`, `Y`, and `Z` are the respective major, minor, and patch numbers of the release number.

Then repeat for `packages/react`.

```shell
cd ../react
npm version major
npm build
```

After both package versions have been bumped, create a PR, get it approved, and merge it to `main`.

Next, checkout the corresponding commit on `main` and run the following commands for 

```shell
npm login
cd ../core
npm publish
cd ../react
npm publish
```

Finally, add a tag of the form `prerelease-X.Y.Z` to the commit on `main`.

```shell
git tag prerelease-X.Y.Z
git push origin --tags
```
