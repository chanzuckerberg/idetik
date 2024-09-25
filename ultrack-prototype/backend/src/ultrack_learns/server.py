from fastapi import FastAPI, APIRouter
from ultrack_learns.models import Task

app = FastAPI()
mock_router = APIRouter(prefix="/mock_data")


@app.get("/")
def read_root():
    return {"Hello": "World"}


@mock_router.get("/task")
def all_tasks() -> list[Task]:
    from ultrack_learns.mock_data import mock_data

    return mock_data


@mock_router.get("/task/{task_id}")
def task(task_id: int) -> Task:
    from ultrack_learns.mock_data import mock_data

    return mock_data[task_id]


app.include_router(mock_router)
