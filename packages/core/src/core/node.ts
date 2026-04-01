import { generateID } from "../utilities/id_generator";

export abstract class Node {
  public readonly id = generateID();

  public abstract get type(): string;
}
