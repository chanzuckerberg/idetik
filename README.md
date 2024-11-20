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

You can run it for development purposes by passing the `prototype` mode to vite:

```shell
npm run dev -- --mode prototype
```

The prototype will try to connect to a backend server running on <http://localhost:8000>. You can
mock this by setting `VITE_MOCK_ULTRACK=true` in your environment. This can be set in a
`ultrack-prototype/frontent/.env` file, or when running the dev server:

```shell
VITE_MOCK_ULTRACK=true npm run dev -- --mode prototype
```

(Note: this is likely to change in the future)


### Backend server

The backend server for the prototype is in the `ultrack-prototype/backend` directory. This is a
Python FastAPI server that serves the data and provides an API for the frontend to interact with.
See the README in that directory for more information on installing and running the server.
