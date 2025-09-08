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
