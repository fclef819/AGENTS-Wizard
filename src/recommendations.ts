import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Answers, Option } from "./model.js";

function globMatch(root: string, glob: string): boolean {
  const suffix = glob.replace("*", "");
  return readdirSync(root, { withFileTypes: true }).some((item) =>
    item.name.endsWith(suffix),
  );
}
export function scoreOption(
  option: Option,
  cwd: string,
  answers: Answers,
): number {
  const rule = option.recommendation;
  if (!rule) return 0;
  const files =
    rule.files_any?.some((file) => existsSync(join(cwd, file))) ?? false;
  const globs = rule.globs_any?.some((glob) => globMatch(cwd, glob)) ?? false;
  const answer = rule.answer_equals;
  const matchesAnswer = answer
    ? answers.get(answer.question)?.answerId === answer.option
    : false;
  return files || globs || matchesAnswer ? rule.score : 0;
}
export function orderedOptions(
  options: Option[],
  cwd: string,
  answers: Answers,
): (Option & { recommended: boolean })[] {
  return options
    .map((option, index) => ({
      ...option,
      score: scoreOption(option, cwd, answers),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ score, index: _index, ...option }) => ({
      ...option,
      recommended: score > 0,
    }));
}
