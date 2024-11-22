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

Data are downloaded from a hard-coded URL and stored in a SQLite database on startup. You can set
`ULTRACK_DB_URL` to set the path to the database file. The default is `ultrack_tmp.db`.

To generate static mock data (`mock_data.json`), run the `write-mock-data-json` command with `uv`.

```bash
$ uv run write-mock-data-json --help
usage: write-mock-data-json [-h] [--seed SEED] [--num_tasks NUM_TASKS]

options:
  -h, --help            show this help message and exit
  --seed SEED
  --num_tasks NUM_TASKS

```

Then mv `mock_data.json` to `../data/mock_data.json`.

If the default `ultrack_tmp.db` file already exists and you want to update it with the same mock data, you need to remove it before running the command above.

Otherwise, mock data is available via the development server at `http://localhost:8000/mock-data`.
Mock data endpoints are:
* `/task` - GET all tasks. This route accepts query parameters `rng_seed` and `num_tasks` to control
  how many tasks are returned and the seed used to generate them.
* `/task/{task_id}` - GET a single task by ID. This is the same as `/task` but filters for a single
  task. This also accepts `rng_seed` and `num_tasks` query parameters, because under the hood it
  still generates the full list of tasks. Task generation is cached based on `rng_seed` and
  `num_tasks` for each run.

Mock data will eventually be controlled by an environment variable and served on the production
endpoints.
