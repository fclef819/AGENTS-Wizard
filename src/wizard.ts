import { input, select } from "@inquirer/prompts";
import { isSkippable, questionPath, reconcileAnswers } from "./catalog.js";
import { checkboxWithActions } from "./checkbox-actions.js";
import type { Answers, Catalog, Question } from "./model.js";
import { orderedOptions } from "./recommendations.js";
import { loadHistory } from "./storage.js";

const BACK = "__back";
const SKIP = "__skip";
const CANCEL = "__cancel";
const CUSTOM = "__custom";
const navigationIds = new Set([BACK, SKIP, CANCEL]);

function navigation(question: Question, catalog: Catalog, index: number) {
  return [
    ...(index ? [{ value: BACK, name: "← ひとつ前の質問へ戻る" }] : []),
    ...(isSkippable(catalog, question)
      ? [{ value: SKIP, name: "スキップ" }]
      : []),
    { value: CANCEL, name: "キャンセルして終了" },
  ];
}

function questionPrefix(catalog: Catalog, id: string): string {
  const roots = catalog.wizard.top_level_questions;
  const owner = new Map<string, string>();
  const visit = (questionId: string, root: string) => {
    if (owner.has(questionId)) return;
    owner.set(questionId, root);
    const question = catalog.questions[questionId];
    for (const child of [
      ...(question.children ?? []),
      ...(question.followups ?? []),
      ...(question.options?.flatMap((option) => option.followups ?? []) ?? []),
    ])
      visit(child, root);
  };
  for (const root of roots) visit(root, root);
  const root = owner.get(id) ?? id;
  const number = roots.indexOf(root) + 1;
  return `【質問 ${number}/${roots.length}${id === root ? "" : "・追加"}】`;
}

async function text(
  question: Question,
  history: Record<string, { value: string }[]>,
  message: string,
): Promise<string> {
  const definition = question.input ?? question.item ?? question.custom_input;
  const previous = history.__current ?? [];
  if (previous.length) {
    const selected = await select({
      message,
      choices: [
        ...previous.map((entry) => ({ value: entry.value, name: entry.value })),
        { value: CUSTOM, name: "新しく入力する" },
      ],
    });
    if (selected !== CUSTOM) return selected;
  }
  const prefix = definition?.prefix ?? "";
  const value = await input({
    message: prefix ? `${message}\n${prefix}` : message,
    ...(prefix
      ? {
          transformer: (inputValue) => inputValue,
        }
      : {}),
  });
  return value;
}

export async function runWizard(
  catalog: Catalog,
  cwd: string,
): Promise<Answers | undefined> {
  const answers: Answers = new Map();
  let index = 0;
  const history = await loadHistory();
  console.log(`\n${catalog.wizard.title ?? "AGENTS.md Wizard"}\n`);
  try {
    while (true) {
      const path = questionPath(catalog, answers).filter(
        (id) => catalog.questions[id].type !== "group",
      );
      if (index >= path.length) break;
      const id = path[index];
      const question = catalog.questions[id];
      const message = `${questionPrefix(catalog, id)} ${question.label}`;
      const nav = navigation(question, catalog, index);
      let result: string | string[] = "";

      if (question.type === "single_select") {
        result = await select({
          message,
          choices: [
            ...orderedOptions(question.options ?? [], cwd, answers).map(
              (option) => ({
                value: option.id,
                name: `${option.label}${option.recommended ? " (おすすめ)" : ""}`,
              }),
            ),
            ...nav.map((item) => ({ ...item, name: `【${item.name}】` })),
          ],
        });
        if (result === "custom") {
          const value = await text(
            {
              ...question,
              input: question.options?.find((option) => option.id === "custom")
                ?.input,
            },
            {},
            message,
          );
          answers.set(id, { questionId: id, answerId: "custom", value });
        } else if (!navigationIds.has(result)) {
          answers.set(id, { questionId: id, answerId: result });
        }
      } else if (question.type === "multi_select") {
        const choices = orderedOptions(
          question.options ?? [],
          cwd,
          answers,
        ).map((option) => ({
          value: option.id,
          name: `${option.label}${option.recommended ? " (おすすめ)" : ""}`,
        }));
        if (question.allow_custom)
          choices.push({
            value: CUSTOM,
            name: question.custom_input?.label ?? "自由入力",
          });
        const selection = await checkboxWithActions({
          message,
          choices,
          actions: nav,
          required: !isSkippable(catalog, question),
        });
        if (selection.type === "navigation") result = selection.value;
        else {
          result = selection.values;
          if (result.includes(CUSTOM)) {
            const custom = await input({
              message: `${message}（自由入力）`,
            });
            result = [...result.filter((value) => value !== CUSTOM), custom];
          }
          answers.set(id, {
            questionId: id,
            answerId: "selected",
            values: result,
          });
        }
      } else if (question.type === "text") {
        const value = await text(
          question,
          { __current: history[id] ?? [] },
          message,
        );
        result = value;
        answers.set(id, { questionId: id, answerId: "custom", value });
      } else if (question.type === "list") {
        const value = await input({
          message: `${message}（複数はカンマ区切り）`,
        });
        result = value;
        answers.set(id, {
          questionId: id,
          answerId: "custom",
          values: value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        });
      } else if (question.type === "pair_list") {
        const pair: Record<string, string> = {};
        for (const field of question.fields ?? [])
          pair[field.id] = await input({
            message: `${message}：${field.label}`,
          });
        result = "done";
        answers.set(id, { questionId: id, answerId: "custom", pairs: [pair] });
      }

      if (result === CANCEL) return undefined;
      if (result === BACK) {
        answers.delete(id);
        index--;
        continue;
      }
      if (result === SKIP)
        answers.set(id, { questionId: id, answerId: "skipped" });
      reconcileAnswers(catalog, answers);
      index++;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError")
      return undefined;
    throw error;
  }
  return answers;
}
