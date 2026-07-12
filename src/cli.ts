#!/usr/bin/env node
import { resolve } from "node:path";
import { confirm, input } from "@inquirer/prompts";
import { stringify } from "yaml";
import { loadCatalog } from "./catalog.js";
import { assertAbsent, writeOutputs } from "./files.js";
import { renderMarkdown } from "./render.js";
import { recordHistory, saveTemplate } from "./storage.js";
import { runWizard } from "./wizard.js";

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("agents-wizard requires an interactive TTY.");
  const catalog = await loadCatalog();
  const cwd = process.cwd();
  const markdownPath = resolve(cwd, catalog.wizard.output_file);
  const statePath = resolve(cwd, catalog.wizard.answer_record_file);
  await assertAbsent(markdownPath);
  const answers = await runWizard(catalog, cwd);
  if (!answers) return;
  for (const [id, answer] of answers) {
    const question = catalog.questions[id];
    const historyEnabled =
      question.input?.history?.enabled ??
      question.item?.history?.enabled ??
      question.custom_input?.history?.enabled ??
      question.options?.find((option) => option.id === answer.answerId)?.input
        ?.history?.enabled ??
      false;
    if (historyEnabled) {
      const values = [
        ...(answer.value ? [answer.value] : []),
        ...(answer.values?.filter(
          (value) => !question.options?.some((option) => option.id === value),
        ) ?? []),
      ];
      const history = await recordHistory(id, values);
      if (question.input?.user_template?.enabled && answer.value) {
        const normalized = answer.value.trim().replace(/\s+/g, " ");
        const entry = history[id]?.find((item) => item.value === normalized);
        if (
          entry &&
          entry.uses >= catalog.wizard.template_promotion_usage_threshold
        ) {
          const promote = await confirm({
            message: "この入力をユーザーテンプレートとして保存しますか？",
            default: false,
          });
          if (promote) {
            const label = await input({ message: "テンプレートの表示ラベル" });
            await saveTemplate(id, label, answer.value);
          }
        }
      }
    }
  }
  const record = {
    version: 1,
    answers: [...answers].map(([id, answer]) => ({
      question: { id, label: catalog.questions[id].label },
      answer: {
        id: answer.answerId,
        label:
          answer.answerId === "skipped"
            ? "スキップ"
            : (catalog.questions[id].options?.find(
                (o) => o.id === answer.answerId,
              )?.label ?? "自由入力"),
        ...(answer.value !== undefined ? { value: answer.value } : {}),
        ...(answer.values ? { values: answer.values } : {}),
        ...(answer.pairs ? { pairs: answer.pairs } : {}),
      },
    })),
  };
  await writeOutputs(
    markdownPath,
    statePath,
    renderMarkdown(catalog, answers),
    stringify(record),
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
