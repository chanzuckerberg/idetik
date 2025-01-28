// To parse this data:
//
//   import { Convert, Plate } from "./file";
//
//   const plate = Convert.toPlate(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * JSON from OME-NGFF .zattrs
 */
export type Plate = {
  plate?: PlateObject;
  [property: string]: any;
};

export type PlateObject = {
  /**
   * The acquisitions for this plate
   */
  acquisitions?: Array<
    any[] | boolean | number | number | null | AcquisitionObject | string
  >;
  /**
   * The columns of the plate
   */
  columns: Column[];
  /**
   * The maximum number of fields per view across all wells
   */
  field_count?: number;
  /**
   * The name of the plate
   */
  name: string;
  /**
   * The rows of the plate
   */
  rows: Row[];
  /**
   * The version of the specification
   */
  version: Version;
  /**
   * The wells of the plate
   */
  wells: Well[];
  [property: string]: any;
};

export type AcquisitionObject = {
  name: any;
  maximumfieldcount: any;
  [property: string]: any;
};

export type Column = {
  /**
   * The column name
   */
  name: string;
  [property: string]: any;
};

export type Row = {
  /**
   * The row name
   */
  name: string;
  [property: string]: any;
};

/**
 * The version of the specification
 */
export enum Version {
  The04 = "0.4",
}

export type Well = {
  /**
   * The index of the well in the columns list
   */
  columnIndex: number;
  /**
   * The path to the well subgroup
   */
  path: string;
  /**
   * The index of the well in the rows list
   */
  rowIndex: number;
  [property: string]: any;
};

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toPlate(json: string): Plate {
    return cast(JSON.parse(json), r("Plate"));
  }

  public static plateToJson(value: Plate): string {
    return JSON.stringify(uncast(value, r("Plate")), null, 2);
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
  const prettyTyp = prettyTypeName(typ);
  const parentText = parent ? ` on ${parent}` : "";
  const keyText = key ? ` for key "${key}"` : "";
  throw Error(
    `Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`
  );
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`;
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a);
        })
        .join(", ")}]`;
    }
  } else if (typeof typ === "object" && typ.literal !== undefined) {
    return typ.literal;
  } else {
    return typeof typ;
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(
  val: any,
  typ: any,
  getProps: any,
  key: any = "",
  parent: any = ""
): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key, parent);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
      } catch (_) {}
    }
    return invalidValue(typs, val, key, parent);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(
      cases.map((a) => {
        return l(a);
      }),
      val,
      key,
      parent
    );
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
    return val.map((el) => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue(l("Date"), val, key, parent);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue(l(ref || "object"), val, key, parent);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, key, ref);
    });
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val, key, parent);
  }
  if (typ === false) return invalidValue(typ, val, key, parent);
  let ref: any = undefined;
  while (typeof typ === "object" && typ.ref !== undefined) {
    ref = typ.ref;
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty("arrayItems")
        ? transformArray(typ.arrayItems, val)
        : typ.hasOwnProperty("props")
          ? transformObject(getProps(typ), typ.additional, val)
          : invalidValue(typ, val, key, parent);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
  return { literal: typ };
}

function a(typ: any) {
  return { arrayItems: typ };
}

function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  Plate: o(
    [{ json: "plate", js: "plate", typ: u(undefined, r("PlateObject")) }],
    "any"
  ),
  PlateObject: o(
    [
      {
        json: "acquisitions",
        js: "acquisitions",
        typ: u(
          undefined,
          a(u(a("any"), true, 3.14, 0, null, r("AcquisitionObject"), ""))
        ),
      },
      { json: "columns", js: "columns", typ: a(r("Column")) },
      { json: "field_count", js: "field_count", typ: u(undefined, 0) },
      { json: "name", js: "name", typ: "" },
      { json: "rows", js: "rows", typ: a(r("Row")) },
      { json: "version", js: "version", typ: r("Version") },
      { json: "wells", js: "wells", typ: a(r("Well")) },
    ],
    "any"
  ),
  AcquisitionObject: o(
    [
      { json: "name", js: "name", typ: "any" },
      { json: "maximumfieldcount", js: "maximumfieldcount", typ: "any" },
    ],
    "any"
  ),
  Column: o([{ json: "name", js: "name", typ: "" }], "any"),
  Row: o([{ json: "name", js: "name", typ: "" }], "any"),
  Well: o(
    [
      { json: "columnIndex", js: "columnIndex", typ: 0 },
      { json: "path", js: "path", typ: "" },
      { json: "rowIndex", js: "rowIndex", typ: 0 },
    ],
    "any"
  ),
  Version: ["0.4"],
};
