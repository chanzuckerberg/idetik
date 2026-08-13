import { ReflectionKind } from "typedoc";
import { MemberRouter } from "typedoc-plugin-markdown";

export function collectDeclarationFiles(project) {
  const files = new Map();
  for (const reflection of Object.values(project.reflections)) {
    const file = reflection.sources?.[0]?.fullFileName;
    if (file) files.set(reflection, file);
  }
  return files;
}

export function foldCompanionAliasesIntoOwnerClasses(
  project,
  declarationFiles
) {
  const containers = [
    project,
    ...(project.children ?? []).filter(
      (c) => c.kind === ReflectionKind.Module
    ),
  ];
  for (const container of containers) {
    const children = container.children ?? [];
    const classes = children.filter((c) => c.kind === ReflectionKind.Class);
    const aliases = children.filter(
      (c) => c.kind === ReflectionKind.TypeAlias
    );
    for (const alias of aliases) {
      const owner = companionOwnerOf(alias, classes, declarationFiles);
      if (!owner) continue;
      dropModuleGroupTag(alias);
      moveChildReflection(alias, container, owner);
    }
  }
}

function companionOwnerOf(alias, classes, declarationFiles) {
  return classes
    .filter(
      (cls) =>
        alias.name.startsWith(cls.name) &&
        alias.name !== cls.name &&
        declaredInSameFile(alias, cls, declarationFiles)
    )
    .sort(mostSpecificClassFirst)[0];
}

const mostSpecificClassFirst = (a, b) => b.name.length - a.name.length;

function declaredInSameFile(alias, cls, declarationFiles) {
  const file = declarationFiles.get(alias);
  return file !== undefined && file === declarationFiles.get(cls);
}

function dropModuleGroupTag(alias) {
  if (!alias.comment) return;
  alias.comment.blockTags = alias.comment.blockTags.filter(
    (tag) => tag.tag !== "@group"
  );
}

function moveChildReflection(child, from, to) {
  from.children = from.children.filter((c) => c !== child);
  from.childrenIncludingDocuments = from.childrenIncludingDocuments?.filter(
    (c) => c !== child
  );
  child.parent = to;
  to.children = [...(to.children ?? []), child];
  to.childrenIncludingDocuments = [
    ...(to.childrenIncludingDocuments ?? []),
    child,
  ];
}

export function isFoldedAlias(reflection) {
  return (
    reflection.kind === ReflectionKind.TypeAlias &&
    reflection.parent?.kind === ReflectionKind.Class
  );
}

export class FoldedAliasRouter extends MemberRouter {
  buildChildPages(reflection, outPages) {
    if (isFoldedAlias(reflection)) {
      this.buildAnchors(reflection, reflection.parent);
      reflection.traverse((child) => {
        this.buildChildPages(child, outPages);
        return true;
      });
      return;
    }
    super.buildChildPages(reflection, outPages);
  }
}

export function foldedAliasDescriptionAndProperties(context, model, opts) {
  const blocks = [];
  if (model.comment) {
    blocks.push(
      context.partials.comment(model.comment, {
        headingLevel: opts.headingLevel,
      })
    );
  }
  const properties = (model.children ?? []).filter((child) =>
    child.isDeclaration()
  );
  if (properties.length) {
    blocks.push(context.partials.propertiesTable(properties));
  }
  return blocks.join("\n\n");
}
