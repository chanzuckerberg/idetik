import { ReflectionType } from "typedoc";

const DESTRUCTURED_DEFAULT = "...";

const twoColumnTable = (nameHeader, rows) =>
  [`| ${nameHeader} | Description |`, "| ------ | ------ |", ...rows].join(
    "\n"
  );

const memberCell = (name, isOptional, type) =>
  `\`${name}${isOptional ? "?" : ""}\`: ${type}`;

const singleLine = (text) => text.replaceAll("\n", " ");

export function foldedPropertiesTable(context, properties) {
  const rows = properties.flatMap((property) =>
    propertyRows(context, property)
  );
  return twoColumnTable("Property", rows);
}

// Nested object members get their own rows (`a.b`, or `a[].b` through arrays)
// so their comments render instead of collapsing into the parent's type.
function propertyRows(context, property, namePrefix = "") {
  const name = namePrefix ? `${namePrefix}.${property.name}` : property.name;
  const anchor =
    !namePrefix && context.router.hasUrl(property)
      ? `<a id="${context.router.getAnchor(property)}"></a> `
      : "";

  const nested = nestedObject(property.type);
  const type = nested
    ? `${nested.readonly ? "readonly " : ""}\`object\`${nested.arraySuffix}`
    : singleLine(context.partials.someType(property.type));

  const description = property.comment
    ? singleLine(
        context.partials.comment(property.comment, { isTableColumn: true })
      )
    : "";

  const cell = memberCell(name, property.flags?.isOptional, type);
  const row = `| ${anchor}${cell} | ${description} |`;
  if (!nested) return [row];

  const childPrefix = `${name}${nested.arraySuffix}`;
  return [
    row,
    ...nested.children.flatMap((child) =>
      propertyRows(context, child, childPrefix)
    ),
  ];
}

function nestedObject(type) {
  let readonly = false;
  let arraySuffix = "";
  let current = type;
  if (current?.type === "typeOperator" && current.operator === "readonly") {
    readonly = true;
    current = current.target;
  }
  while (current?.type === "array") {
    arraySuffix += "[]";
    current = current.elementType;
  }
  const children = current?.declaration?.children;
  return children?.length ? { readonly, arraySuffix, children } : undefined;
}

export function twoColumnParametersTable(context, model) {
  const firstOptionalIndex = model.findIndex((p) => p.flags.isOptional);

  const rows = model.flatMap((parameter, index) =>
    parameterRows(
      context,
      parameter,
      firstOptionalIndex !== -1 && index > firstOptionalIndex
    )
  );

  return twoColumnTable("Parameter", rows);
}

function parameterRows(context, parameter, cascadeOptional, namePrefix = "") {
  const name = namePrefix ? `${namePrefix}.${parameter.name}` : parameter.name;
  const isOptional = parameter.flags?.isOptional || cascadeOptional;
  const rest = parameter.flags?.isRest ? "..." : "";

  const type = parameter.type
    ? singleLine(
        parameter.type instanceof ReflectionType
          ? context.partials.reflectionType(parameter.type, {
              forceCollapse: true,
            })
          : context.partials.someType(parameter.type)
      )
    : "";

  let description = parameter.comment
    ? singleLine(
        context.partials.comment(parameter.comment, { isTableColumn: true })
      ).trim()
    : "";
  if (
    parameter.defaultValue &&
    parameter.defaultValue !== DESTRUCTURED_DEFAULT
  ) {
    description =
      `${description} Defaults to \`${parameter.defaultValue}\`.`.trim();
  }

  const row = `| ${rest}${memberCell(name, isOptional, type)} | ${description} |`;
  const children = parameter.type?.declaration?.children ?? [];

  return [
    row,
    ...children.flatMap((child) =>
      parameterRows(context, child, cascadeOptional, name)
    ),
  ];
}
