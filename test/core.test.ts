import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { questionPath, reconcileAnswers } from "../src/catalog.js";
import { assertAbsent, writeOutputs } from "../src/files.js";
import type { Answers, Catalog } from "../src/model.js";
import { renderMarkdown } from "../src/render.js";

const catalog: Catalog = {
  wizard: {
    output_file: "AGENTS.md",
    answer_record_file: ".agents-wizard.yml",
    default_skippable: true,
    history_limit: 3,
    template_promotion_usage_threshold: 2,
    top_level_questions: ["root"],
  },
  sections: { overview: { title: "Project Overview", order: 1 } },
  questions: {
    root: {
      label: "Root",
      type: "single_select",
      order: 1,
      options: [
        {
          id: "a",
          label: "A",
          followups: ["child"],
          output: { section: "overview", kind: "paragraph", markdown: "A" },
        },
        { id: "b", label: "B" },
      ],
    },
    child: {
      label: "Child",
      type: "text",
      order: 2,
      output: {
        section: "overview",
        kind: "paragraph",
        template: "このプロジェクトは、{{ value }}",
      },
    },
  },
};
describe("core behavior", () => {
  it("rebuilds path and only removes out-of-route answers", () => {
    const answers: Answers = new Map([
      ["root", { questionId: "root", answerId: "a" }],
      ["child", { questionId: "child", answerId: "custom", value: "x" }],
    ]);
    expect(questionPath(catalog, answers)).toEqual(["root", "child"]);
    answers.set("root", { questionId: "root", answerId: "b" });
    reconcileAnswers(catalog, answers);
    expect(answers.has("child")).toBe(false);
  });
  it("renders deterministic markdown and omits skipped", () => {
    const answers: Answers = new Map([
      ["root", { questionId: "root", answerId: "a" }],
      ["child", { questionId: "child", answerId: "custom", value: "目的" }],
    ]);
    expect(renderMarkdown(catalog, answers)).toBe(
      "## Project Overview\n\nA\n\nこのプロジェクトは、目的\n",
    );
  });
  it("rejects existing files including symlinks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aw-"));
    const path = join(dir, "AGENTS.md");
    await writeFile(path, "x");
    await expect(assertAbsent(path)).rejects.toThrow("already exists");
    const link = join(dir, "link");
    await symlink(path, link);
    await expect(assertAbsent(link)).rejects.toThrow("already exists");
  });
  it("writes both generated files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aw-"));
    const markdown = join(dir, "AGENTS.md");
    const state = join(dir, ".agents-wizard.yml");
    await writeOutputs(markdown, state, "hello\n", "version: 1\n");
    expect(await readFile(markdown, "utf8")).toBe("hello\n");
  });
});
