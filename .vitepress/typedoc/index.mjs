import {
  Application,
  Converter,
  OptionDefaults,
  RendererEvent,
} from "typedoc";
import { MarkdownPageEvent } from "typedoc-plugin-markdown";
import {
  collectDeclarationFiles,
  foldCompanionAliasesIntoOwnerClasses,
  FoldedAliasRouter,
} from "./companion-types.mjs";
import {
  removeInheritedMembers,
  renameGroupsToDisplayTitles,
  stripSourcesToSuppressDefinedIn,
} from "./project-transforms.mjs";
import { IdetikTheme } from "./theme.mjs";

const UNRENDERED_TAGS = ["@see", "@throws"];

export function load(app) {
  app.renderer.defineTheme("idetik", IdetikTheme);
  app.renderer.defineRouter("idetik", FoldedAliasRouter);

  app.on(Application.EVENT_BOOTSTRAP_END, () => {
    app.options.setValue("excludeTags", [
      ...OptionDefaults.excludeTags,
      ...UNRENDERED_TAGS,
    ]);
  });

  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, ({ project }) => {
    removeInheritedMembers(project);
    const declarationFiles = collectDeclarationFiles(project);
    stripSourcesToSuppressDefinedIn(project);
    foldCompanionAliasesIntoOwnerClasses(project, declarationFiles);
  });

  app.renderer.on(RendererEvent.BEGIN, ({ project }) => {
    renameGroupsToDisplayTitles(project);
  });

  app.renderer.on(MarkdownPageEvent.END, (page) => {
    if (page.contents) page.contents = withApiPageClass(page.contents);
  });
}

function withApiPageClass(contents) {
  return contents.startsWith("---\n")
    ? contents.replace("---\n", "---\npageClass: api\n")
    : `---\npageClass: api\n---\n\n${contents}`;
}
