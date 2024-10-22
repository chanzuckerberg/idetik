export enum Answer {
  YES = "Yes",
  NO = "No",
  UNCERTAIN = "Uncertain",
}

export type Task = {
  index: number;
  question: string;
  answer?: Answer;
};
