type PlyType =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "float32"
  | "float64";

// PLY allows both the legacy and sized type names.
const PLY_TYPES: Record<string, PlyType> = {
  char: "int8",
  int8: "int8",
  uchar: "uint8",
  uint8: "uint8",
  short: "int16",
  int16: "int16",
  ushort: "uint16",
  uint16: "uint16",
  int: "int32",
  int32: "int32",
  uint: "uint32",
  uint32: "uint32",
  float: "float32",
  float32: "float32",
  double: "float64",
  float64: "float64",
};

const TYPE_BYTES: Record<PlyType, number> = {
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  float32: 4,
  float64: 8,
};

type PlyProperty = { name: string; type: PlyType; offset: number };

type PlyElement = {
  name: string;
  count: number;
  stride: number;
  properties: PlyProperty[];
};

function readValue(view: DataView, offset: number, type: PlyType): number {
  switch (type) {
    case "int8":
      return view.getInt8(offset);
    case "uint8":
      return view.getUint8(offset);
    case "int16":
      return view.getInt16(offset, true);
    case "uint16":
      return view.getUint16(offset, true);
    case "int32":
      return view.getInt32(offset, true);
    case "uint32":
      return view.getUint32(offset, true);
    case "float32":
      return view.getFloat32(offset, true);
    case "float64":
      return view.getFloat64(offset, true);
  }
}

function parseHeader(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const marker = "end_header\n";
  const limit = Math.min(bytes.length, 64 * 1024);
  // Latin-1 maps each byte to one character, so indices are byte offsets.
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, limit));
  const end = text.indexOf(marker);
  if (!text.startsWith("ply") || end === -1) {
    throw new Error("Not a PLY file");
  }

  const elements: PlyElement[] = [];
  for (const line of text.slice(0, end).split(/\r?\n/)) {
    const [keyword, ...rest] = line.trim().split(/\s+/);
    if (keyword === "format" && rest[0] !== "binary_little_endian") {
      throw new Error(`Unsupported PLY format: ${rest[0]}`);
    }
    if (keyword === "element") {
      elements.push({
        name: rest[0],
        count: Number(rest[1]),
        stride: 0,
        properties: [],
      });
    }
    if (keyword === "property") {
      const element = elements[elements.length - 1];
      if (rest[0] === "list") {
        throw new Error(`Unsupported PLY list property in ${element.name}`);
      }
      const type = PLY_TYPES[rest[0]];
      if (type === undefined) {
        throw new Error(`Unsupported PLY property type: ${rest[0]}`);
      }
      element.properties.push({
        name: rest[1],
        type,
        offset: element.stride,
      });
      element.stride += TYPE_BYTES[type];
    }
  }
  return { elements, dataOffset: end + marker.length };
}

/**
 * Reads the named properties of the `vertex` element of a binary
 * little-endian PLY file.
 *
 * @param buffer - The PLY file contents.
 * @param names - The vertex properties to read.
 * @returns The vertex count and one array per requested property.
 */
export function readPlyVertices<Name extends string>(
  buffer: ArrayBuffer,
  names: readonly Name[]
): { count: number; properties: Record<Name, Float32Array> } {
  const { elements, dataOffset } = parseHeader(buffer);
  let offset = dataOffset;
  for (const element of elements) {
    if (element.name === "vertex") break;
    offset += element.count * element.stride;
  }
  const vertex = elements.find((element) => element.name === "vertex");
  if (!vertex) {
    throw new Error("PLY file has no vertex element");
  }

  const view = new DataView(buffer);
  const properties = {} as Record<Name, Float32Array>;
  for (const name of names) {
    const property = vertex.properties.find((p) => p.name === name);
    if (!property) {
      throw new Error(`PLY vertex element has no property ${name}`);
    }
    const values = new Float32Array(vertex.count);
    for (let i = 0; i < vertex.count; i++) {
      const at = offset + i * vertex.stride + property.offset;
      values[i] = readValue(view, at, property.type);
    }
    properties[name] = values;
  }
  return { count: vertex.count, properties };
}
