import { ReflectionKind } from "typedoc";

const DISPLAY_TITLE_BY_TYPEDOC_GROUP = {
  "Type Aliases": "Types",
  Constructors: "Constructor",
};

export function removeInheritedMembers(project) {
  for (const reflection of Object.values(project.reflections)) {
    if (inheritsWithoutOverriding(reflection)) {
      project.removeReflection(reflection);
    }
  }
}

function inheritsWithoutOverriding(reflection) {
  return Boolean(
    reflection.inheritedFrom ||
      reflection.getSignature?.inheritedFrom ||
      reflection.setSignature?.inheritedFrom ||
      (reflection.signatures?.length &&
        reflection.signatures.every((s) => s.inheritedFrom))
  );
}

export function removeImplicitConstructors(project, declarationFiles) {
  for (const reflection of Object.values(project.reflections)) {
    if (reflection.kind !== ReflectionKind.Constructor) continue;
    const declared =
      declarationFiles.has(reflection) ||
      (reflection.signatures ?? []).some((signature) =>
        declarationFiles.has(signature)
      );
    if (!declared) project.removeReflection(reflection);
  }
}

export function stripSourcesToSuppressDefinedIn(project) {
  for (const reflection of Object.values(project.reflections)) {
    if ("sources" in reflection) reflection.sources = undefined;
    for (const signature of reflection.signatures ?? []) {
      signature.sources = undefined;
    }
  }
}

export function renameGroupsToDisplayTitles(project) {
  for (const reflection of Object.values(project.reflections)) {
    if (reflection.kind !== ReflectionKind.Class) continue;
    for (const group of reflection.groups ?? []) {
      group.title = DISPLAY_TITLE_BY_TYPEDOC_GROUP[group.title] ?? group.title;
    }
  }
}
