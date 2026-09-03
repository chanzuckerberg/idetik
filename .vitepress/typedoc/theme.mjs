import { ReflectionKind } from "typedoc";
import { MarkdownTheme, MarkdownThemeContext } from "typedoc-plugin-markdown";
import {
  foldedAliasDescriptionAndProperties,
  isFoldedAlias,
} from "./companion-types.mjs";
import { twoColumnParametersTable } from "./member-tables.mjs";

export class IdetikTheme extends MarkdownTheme {
  getRenderContext(page) {
    return new IdetikThemeContext(this, page, this.application.options);
  }
}

const overridesBadgeReplacesInheritanceSection = () => "";

class IdetikThemeContext extends MarkdownThemeContext {
  constructor(theme, page, options) {
    super(theme, page, options);
    const base = this.partials;
    this.partials = {
      ...base,
      hierarchy: (model, opts) =>
        extendsNoteOrExtendedByList(this, model, opts),
      memberWithGroups: (model, opts) =>
        isFoldedAlias(model)
          ? foldedAliasDescriptionAndProperties(this, model, opts)
          : withInterfaceRelationNotes(
              this,
              model,
              opts,
              base.memberWithGroups(model, opts)
            ),
      declaration: (model, opts) =>
        declarationWithDescriptionFirst(this, model, opts),
      parametersTable: (model) => twoColumnParametersTable(this, model),
      signatureParameters: (model) =>
        singleLineSignatureParameters(this, model),
      members: (model, opts) =>
        membersWithoutHorizontalRules(this, model, opts),
      constructor: (model, opts) =>
        constructorSignaturesWithoutHeading(this, model, opts),
      signature: (model, opts) =>
        signatureWithDescriptionFirst(this, model, opts),
      accessor: (model, opts) =>
        accessorWithDescriptionFirst(this, model, opts),
      memberContainer: (model, opts) =>
        memberWithDecoratedHeading(this, model, opts),
      inheritance: overridesBadgeReplacesInheritanceSection,
    };
  }
}

const heading = (level, text) => `${"#".repeat(level)} ${text}`;

function extendsNoteOrExtendedByList(context, model, opts) {
  const blocks = [];
  for (let level = model; level?.next; level = level.next) {
    const extendsText = level.isTarget
      ? null
      : level.types
          .map((type) =>
            context.helpers.getHierarchyType(type, { isTarget: false })
          )
          .join(".")
          .replaceAll("`", "");
    if (extendsText) {
      blocks.push(
        `> Extends ${extendsText} and inherits all public properties and methods.`
      );
    } else {
      blocks.push(
        heading(opts.headingLevel, "Extended by"),
        level.next.types
          .map(
            (type) =>
              `- ${context.helpers.getHierarchyType(type, {
                isTarget: level.next.isTarget || false,
              })}`
          )
          .join("\n")
      );
    }
  }
  return blocks.join("\n\n");
}

function withInterfaceRelationNotes(context, model, opts, markdown) {
  const hashes = "#".repeat(opts.headingLevel);

  const implementsSection = new RegExp(
    `${hashes} Implements\n\n(- .+(?:\n- .+)*)`
  );
  let out = markdown.replace(implementsSection, (_, items) => {
    if (model.extendedTypes?.length) return "";
    const names = items
      .split("\n")
      .map((item) => item.replace("- ", "").replaceAll("`", ""));
    return `> Implements ${names.join(" and ")}.`;
  });
  out = out.replace(/\n{3,}/g, "\n\n");

  if (model.kind === ReflectionKind.Interface && model.implementedBy?.length) {
    const list = model.implementedBy
      .map(
        (type) =>
          `- ${context.helpers.getHierarchyType(type, { isTarget: false })}`
      )
      .join("\n");
    const section = `${hashes} Implemented by\n\n${list}`;
    const firstHeading = out.indexOf(`\n${hashes} `);
    out =
      firstHeading === -1
        ? `${out}\n\n${section}`
        : `${out.slice(0, firstHeading)}\n\n${section}\n${out.slice(firstHeading)}`;
  }

  return out;
}

function declarationWithDescriptionFirst(context, model, opts) {
  const blocks = [];
  if (model.comment) {
    blocks.push(
      context.partials.comment(model.comment, {
        headingLevel: opts.headingLevel,
      })
    );
  }
  blocks.push(context.partials.declarationTitle(model));
  return blocks.join("\n\n");
}

function singleLineSignatureParameters(context, model) {
  const expandTypes = context.options.getValue("expandParameters");
  const parameters = model
    .map((parameter) => {
      const rest = parameter.flags?.isRest ? "..." : "";
      const optional =
        parameter.flags.isOptional || parameter.defaultValue ? "?" : "";
      const name = `${rest}\`${parameter.name}${optional}\``;
      return expandTypes
        ? `${name}: ${context.partials.someType(parameter.type)}`
        : name;
    })
    .join(", ");
  return `(${parameters})`;
}

function memberWithDecoratedHeading(context, model, opts) {
  const blocks = [];
  if (
    !context.router.hasOwnDocument(model) &&
    model.kind !== ReflectionKind.Constructor
  ) {
    blocks.push(
      heading(opts.headingLevel, decoratedHeadingWithPinnedAnchor(context, model))
    );
  }
  blocks.push(
    context.partials.member(model, {
      headingLevel: opts.headingLevel,
      nested: opts.nested,
    })
  );
  return blocks.join("\n\n");
}

function decoratedHeadingWithPinnedAnchor(context, model) {
  const signature = model.signatures?.[0] ?? model.getSignature;
  const parts = [context.partials.memberTitle(model)];

  const returnType = returnTypeForHeading(context, signature);
  if (returnType) {
    parts.push(`<span class="return-type">${returnType}</span>`);
  }

  if (model.overwrites || signature?.overwrites) {
    parts.push(`<Badge type="info" text="overrides" />`);
  }

  const anchor = context.router.hasUrl(model)
    ? context.router.getAnchor(model)
    : undefined;
  if (anchor) {
    parts.push(`{#${anchor}}`);
  }
  return parts.join(" ");
}

function returnTypeForHeading(context, signature) {
  if (!signature?.type) return undefined;
  const inlineHtml = toHeadingSafeInlineHtml(
    context.partials.someType(signature.type)
  );
  return inlineHtml.includes("\n") ? undefined : inlineHtml;
}

function toHeadingSafeInlineHtml(typeMarkdown) {
  return typeMarkdown
    .replaceAll("`", "")
    .replaceAll(String.raw`\<`, "&lt;")
    .replaceAll(String.raw`\>`, "&gt;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function signatureWithDescriptionFirst(context, model, opts) {
  const comment = opts.multipleSignatures
    ? model.comment
    : model.comment || model.parent?.comment;

  const description =
    comment &&
    context.partials.comment(comment, {
      headingLevel: opts.headingLevel,
      showTags: false,
      showSummary: true,
    });

  const codeBlock =
    !opts.hideTitle &&
    context.partials.signatureTitle(model, { accessor: opts.accessor });

  const hasTypeParameters =
    model.typeParameters?.length &&
    model.kind !== ReflectionKind.ConstructorSignature;

  const remainingTags =
    comment &&
    context.partials.comment(comment, {
      headingLevel: opts.headingLevel,
      showTags: true,
      showSummary: false,
    });

  return [
    description,
    codeBlock,
    hasTypeParameters && heading(opts.headingLevel, "Type Parameters"),
    hasTypeParameters &&
      context.partials.typeParametersTable(model.typeParameters),
    model.parameters?.length &&
      context.partials.parametersTable(model.parameters),
    remainingTags,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function accessorWithDescriptionFirst(context, model, opts) {
  const blocks = [];
  let documentedBySignature = false;

  for (const [signature, accessor] of [
    [model.getSignature, "get"],
    [model.setSignature, "set"],
  ]) {
    if (!signature) continue;
    if (signature.comment) {
      documentedBySignature = true;
      blocks.push(
        context.partials.comment(signature.comment, {
          headingLevel: opts.headingLevel + 1,
        })
      );
    }
    blocks.push(context.partials.signatureTitle(signature, { accessor }));
    if (signature.parameters?.length) {
      blocks.push(context.partials.parametersTable(signature.parameters));
    }
  }

  if (model.comment && !documentedBySignature) {
    blocks.push(
      context.partials.comment(model.comment, {
        headingLevel: opts.headingLevel,
      })
    );
  }

  return blocks.filter(Boolean).join("\n\n");
}

function constructorSignaturesWithoutHeading(context, model, opts) {
  return (model.signatures ?? [])
    .map((signature) =>
      context.partials.signature(signature, {
        headingLevel: opts.headingLevel + 1,
      })
    )
    .join("\n\n");
}

function membersWithoutHorizontalRules(context, model, opts) {
  return model
    .filter((item) => !context.router.hasOwnDocument(item))
    .map((item) =>
      context.partials.memberContainer(item, {
        headingLevel: opts.headingLevel,
        groupTitle: opts.groupTitle,
      })
    )
    .join("\n\n");
}
