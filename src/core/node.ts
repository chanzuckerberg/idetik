import { generateUUID } from "core/utils";

export abstract class Node {
  public readonly uuid = generateUUID();

  public abstract get type(): string;
}
