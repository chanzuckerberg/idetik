// TODO: this is a temporary store for hard-coded data. It will be replaced by
// a more dynamic data source in the future.
import { Answer, Task } from "./tasks";

import tasks from "../../data/mock_data.json";

// TODO: perhaps could be an async iterator or something
export async function fetchTasks(): Promise<Task[]> {
  return tasks.map((task) => Task.fromJSON(task));
}

export async function postAnswers(answers: Answer[]): Promise<Answer[]> {
  return answers.map((answer) => ({ ...answer, synced: "synced" }));
}
