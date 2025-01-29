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


## OrganelleBox prototype

The `organellebox-prototype` directory contains a prototype for a declarative viewer component.

You can run it for development purposes by passing the `organellebox` mode to vite:

```shell
npm run dev -- --mode organellebox
```

(Note: this is likely to change in the future)

## Ultrack active learning prototype

The `ultrack-prototype` directory contains our first driving example of an active learning application.
It is a prototype for internal demos and testing, but not for production or public distribution.

You can run it for development purposes by passing the `ultrack` mode to vite:

```shell
npm run dev -- --mode ultrack
```

The prototype will try to connect to a backend server running on <http://localhost:8000>. You can
mock this by setting `VITE_MOCK_ULTRACK=true` in your environment. This can be set in a
`ultrack-prototype/frontent/.env` file, or when running the dev server:

```shell
VITE_MOCK_ULTRACK=true npm run dev -- --mode ultrack
```

(Note: this is likely to change in the future)


### Backend server

The backend server for the prototype is in the `ultrack-prototype/backend` directory. This is a
Python FastAPI server that serves the data and provides an API for the frontend to interact with.
See `ultrack-prototype/backend/README.md` for more information on installing and running the server.

### Running on Bruno

First, clone the repo into your home directory on Bruno.

The full-stack prototype can be run as a slurm batch job on Bruno with the
provided script in `ultrack-prototype/run-full-stack.slurm`:

```shell
❯ ssh $USER@login01.czbiohub.org
❯ # ...you will need to confirm login using Duo 2FA
❯ cd src/imaging-active-learning  # or whatever your local path to the repo
❯ sbatch ./ultrack-prototype/run-full-stack.slurm
Submitted batch job 1234567  # job ID will be unique
❯ squeue --user $USER
JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
1234567       cpu ultrack- your.name  R      28:23      1 cpu-c-1
```

Take the node ID from the output of `squeue` (`cpu-c-1` in this case) and open
a second SSH connection (for example in a new terminal) to set up local tunnels
to the FE and BE servers. Both servers need to be mapped because the frontend
is a purely client-side application, and it needs to be able to communicate
directly with the backend from your computer.

```shell
❯ ssh -L 5173:localhost:5173 -L 8000:localhost:8000 -J $USER@login01.czbiohub.org $USER@cpu-c-1
❯ # ...again you will need to confirm login using Duo 2FA
```

Now you should be able to access the prototype application on
`http://localhost:5173`. Likewise the backend server is accessible on
`http://localhost:8000` as if you were running it locally. Other users can
access the same running instance by just opening the tunneling SSH session.

`run-full-stack.slurm` is just a bash script, so you can also use it to
run both front- and back-end servers locally.

