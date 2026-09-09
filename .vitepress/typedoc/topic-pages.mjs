import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Comment,
  CommentTag,
  DeclarationReflection,
  ReflectionKind,
} from "typedoc";
import { moveChildReflection } from "./companion-types.mjs";

const TOPIC_PAGES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "topic-pages"
);

const TOPIC_PAGES = [
  {
    name: "LoadingPolicies",
    group: "Data Loading",
    introFile: "loading_policies.md",
    members: [
      "createExplorationPolicy",
      "createPlaybackPolicy",
      "createNoPrefetchPolicy",
      "createImageSourcePolicy",
    ],
  },
];

export function createTopicPages(project) {
  for (const topic of TOPIC_PAGES) {
    const intro = readFileSync(
      join(TOPIC_PAGES_DIR, topic.introFile),
      "utf8"
    ).trim();

    const page = new DeclarationReflection(
      topic.name,
      ReflectionKind.Namespace,
      project
    );
    page.comment = new Comment(
      [{ kind: "text", text: intro }],
      [new CommentTag("@group", [{ kind: "text", text: topic.group }])]
    );

    project.registerReflection(page, undefined, undefined);
    project.children = [...(project.children ?? []), page];
    project.childrenIncludingDocuments = [
      ...(project.childrenIncludingDocuments ?? []),
      page,
    ];

    for (const name of topic.members) {
      const member = project.children.find((child) => child.name === name);
      if (member) moveChildReflection(member, project, page);
    }
  }
}
