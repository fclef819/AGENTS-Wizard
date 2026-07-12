import { mkdir, readFile, writeFile } from "node:fs/promises";
import envPaths from "env-paths";
import { parse, stringify } from "yaml";
import type { Answers, Catalog } from "./model.js";

type Entry = { value: string; uses: number; lastUsed: string };
type History = Record<string, Entry[]>;
const paths = () => envPaths("agents-wizard").config;
const historyPath = () => `${paths()}/history.yml`;
const templatesPath = () => `${paths()}/templates.yml`;
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
export async function loadHistory(): Promise<History> {
  try {
    return (parse(await readFile(historyPath(), "utf8")) as History) ?? {};
  } catch {
    return {};
  }
}
export async function recordHistory(
  questionId: string,
  values: string[],
): Promise<History> {
  const history = await loadHistory();
  const entries = history[questionId] ?? [];
  for (const raw of values) {
    const value = normalize(raw);
    if (!value) continue;
    const found = entries.find((entry) => normalize(entry.value) === value);
    if (found) {
      found.uses++;
      found.lastUsed = new Date().toISOString();
    } else entries.push({ value, uses: 1, lastUsed: new Date().toISOString() });
  }
  history[questionId] = entries.sort((a, b) =>
    b.lastUsed.localeCompare(a.lastUsed),
  );
  await mkdir(paths(), { recursive: true });
  await writeFile(historyPath(), stringify(history), "utf8");
  return history;
}
export async function saveAnswers(
  path: string,
  catalog: Catalog,
  answers: Answers,
): Promise<void> {
  const entries = [...answers].map(([id, answer]) => ({
    question: { id, label: catalog.questions[id].label },
    answer: {
      id: answer.answerId,
      label:
        answer.answerId === "skipped"
          ? "スキップ"
          : (catalog.questions[id].options?.find(
              (option) => option.id === answer.answerId,
            )?.label ?? "自由入力"),
      ...(answer.value !== undefined ? { value: answer.value } : {}),
      ...(answer.values ? { values: answer.values } : {}),
      ...(answer.pairs ? { pairs: answer.pairs } : {}),
    },
  }));
  await writeFile(path, stringify({ version: 1, answers: entries }), "utf8");
}
export async function loadTemplates(): Promise<Record<string, unknown>> {
  try {
    return (
      (parse(await readFile(templatesPath(), "utf8")) as Record<
        string,
        unknown
      >) ?? {}
    );
  } catch {
    return {};
  }
}
export async function saveTemplate(
  questionId: string,
  label: string,
  markdown: string,
): Promise<void> {
  const templates = await loadTemplates();
  const entries =
    (templates[questionId] as
      | { label: string; markdown: string }[]
      | undefined) ?? [];
  if (!entries.some((entry) => entry.markdown === markdown))
    entries.push({ label, markdown });
  templates[questionId] = entries;
  await mkdir(paths(), { recursive: true });
  await writeFile(templatesPath(), stringify(templates), "utf8");
}
export { templatesPath };
