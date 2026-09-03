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
  const rows = context.helpers
    .getFlattenedDeclarations(properties)
    .map((property) => {
      const anchor = context.router.hasUrl(property)
        ? `<a id="${context.router.getAnchor(property)}"></a> `
        : "";

      const type = singleLine(context.partials.someType(property.type));

      const description = property.comment
        ? singleLine(
            context.partials.comment(property.comment, { isTableColumn: true })
          )
        : "";

      const cell = memberCell(property.name, property.flags?.isOptional, type);
      return `| ${anchor}${cell} | ${description} |`;
    });

  return twoColumnTable("Property", rows);
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
