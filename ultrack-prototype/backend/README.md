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

To run the development server, run the following command.

```bash
$ uv run fastapi dev src/ultrack_learns/server.py
```
