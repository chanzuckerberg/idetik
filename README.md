# Project

A layer-based library for interactive visualization of large datasets.

## Getting started

1. Install the dependencies required by this project (from within this directory):

   `npm install`

   Re-run this command any time the dependencies listed in [package.json](package.json) change, such as after checking out a different revision or pulling changes.

2. To run a local server for development purposes:

   `npm run dev`

   This will start a server on <http://localhost:5173>.

3. To run the unit test suite on Chrome:

   `npm test` or `npm run coverage` to generate a coverage report.

   By default, the test runner will watch for changes to the source files and re-run the tests
   automatically, so you can leave it running while you work. To run the tests once and exit, use
   `npm run test -- --run`.

4. See [package.json](package.json) for other commands available.


## Ultrack active learning prototype

The `ultrack-prototype` directory contains our first driving example of an active learning application.
It is a prototype for internal demos and testing, but not for production or public distribution.

You can develop against by passing a mode to the local server:

```shell
npm run dev -- --mode prototype
```
