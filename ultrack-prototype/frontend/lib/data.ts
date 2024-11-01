import { Answer, Task } from "./tasks";

const SERVER_URL = "http://localhost:8000";

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch(`${SERVER_URL}/mock_data/task`);
  const tasks = await response.json();
  return tasks.map((task: unknown) => Task.fromJSON(task));
}

export async function postAnswers(answers: Answer[]): Promise<Answer[]> {
  // TODO: support retrying failed syncs?
  const post = fetch(`${SERVER_URL}/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      answers.map((answer) => ({
        task_id: answer.taskId,
        answer_id: answer.answerId,
        answer: answer.value.toLowerCase(),
      }))
    ),
  });

  let response;
  try {
    response = await post;
  } catch (error) {
    console.error("SYNC FAILED", error);
    return answers.map((answer) => ({ ...answer, synced: "error" }));
  }

  // TODO: set separate status for each answer (requires server changes as well)
  if (!response.ok) {
    console.log("SYNC FAILED", await response.json());
    return answers.map((answer) => ({ ...answer, synced: "error" }));
  } else {
    console.log("SYNCED", await response.json());
    return answers.map((answer) => ({ ...answer, synced: "synced" }));
  }
}
