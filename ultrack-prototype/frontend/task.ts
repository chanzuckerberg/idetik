export type Answer = "Unanswered" | "Yes" | "No" | "Uncertain";

export type Task = {
  index: number;
  question: string;
  answer: Answer;
};
