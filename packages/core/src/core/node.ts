import { generateUUID } from "utilities/uuid_generator";

export abstract class Node {
  public readonly uuid = generateUUID();

  public abstract get type(): string;
}
