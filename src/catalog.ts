import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { Answers, Catalog, Question } from "./model.js";

export async function loadCatalog(): Promise<Catalog> {
  const path = fileURLToPath(new URL("../questions.yaml", import.meta.url));
  return parse(await readFile(path, "utf8")) as Catalog;
}

export function questionPath(catalog: Catalog, answers: Answers): string[] {
  const result: string[] = [];
  const visit = (id: string) => {
    if (result.includes(id)) return;
    const question = catalog.questions[id];
    if (!question) throw new Error(`Unknown question ID: ${id}`);
    if (question.type === "group") {
      result.push(id);
      for (const child of question.children ?? []) visit(child);
      return;
    }
    result.push(id);
    const answer = answers.get(id);
    const followups = new Set(question.followups ?? []);
    if (answer?.answerId) {
      const selected = question.options?.find(
        (option) => option.id === answer.answerId,
      );
      for (const child of selected?.followups ?? []) followups.add(child);
    }
    for (const child of followups) visit(child);
  };
  for (const id of catalog.wizard.top_level_questions) visit(id);
  return result;
}

export function reconcileAnswers(catalog: Catalog, answers: Answers): void {
  const valid = new Set(questionPath(catalog, answers));
  for (const id of answers.keys()) if (!valid.has(id)) answers.delete(id);
}

export function isSkippable(catalog: Catalog, question: Question): boolean {
  return question.skippable ?? catalog.wizard.default_skippable;
}
