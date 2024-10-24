export enum Answer {
  UNANSWERED = "Unanswered",
  YES = "Yes",
  NO = "No",
  UNCERTAIN = "Uncertain",
}

export type Task = {
  index: number;
  question: string;
  answer: Answer;
};
