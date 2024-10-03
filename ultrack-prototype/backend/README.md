# Ultrack Prototype Backend

This is the backend for the Ultrack prototype. It is a simple API for the frontend to GET questions
and POST answers.

## Installation

This project is meant to be managed with `uv`. To install `uv`, run the following command (or see
the [uv repository](https://github.com/astral-sh/uv?tab=readme-ov-file#installation)).

```bash
# On macOS and Linux.
$ curl -LsSf https://astral.sh/uv/install.sh | sh

# On Windows.
$ powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

`uv` will create a virtual environment and install the dependencies when you first run a command in
the project.

## Usage

### Development Server

To run the development server, run the following command.

```bash
$ uv run fastapi dev src/ultrack_learns/server.py
```

Documentation for the API can be found at `http://localhost:8000/docs`.

### Mock Data

Mock data is downloaded from a hard-coded URL in the development server. Data are then stored in a
SQLite database on startup. You can set `ULTRACK_DB_URL` to set the path to the database file. The
default is `ultrack_tmp.db`

To generate static mock data (`mock_data.json`), run the following command.

```bash
$ uv run write-mock-data-json
```

Otherwise, mock data is avaialable via the development server at `http://localhost:8000/mock-data`.
Mock data endpoints are:
* `/task` - GET all tasks. This route accepts query parameters `rng_seed` and `num_tasks` to control
  how many tasks are returned and the seed used to generate them.
* `/task/{task_id}` - GET a single task by ID. This is the same as `/task` but filters for a single
  task. This also accepts `rng_seed` and `num_tasks` query parameters, because under the hood it
  still generates the full list of tasks. Task generation is cached based on `rng_seed` and
  `num_tasks` for each run.

