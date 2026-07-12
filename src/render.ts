import type { Answer, Answers, Catalog, Output, Question } from "./model.js";

const interpolate = (template: string, values: Record<string, string>) =>
  template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => values[key] ?? "");
function outputFor(question: Question, answer: Answer): Output | undefined {
  if (question.type === "single_select")
    return (
      question.options?.find((o) => o.id === answer.answerId)?.output ??
      question.output ??
      undefined
    );
  return question.output ?? undefined;
}
function body(question: Question, answer: Answer, output: Output): string[] {
  const option = question.options?.find((item) => item.id === answer.answerId);
  const custom =
    answer.values?.filter(
      (value) => !question.options?.some((item) => item.id === value),
    ) ?? [];
  if (output.kind === "paragraph")
    return [
      output.markdown ??
        interpolate(output.template ?? "", { value: answer.value ?? "" }),
    ].filter(Boolean);
  if (output.kind === "bullet")
    return [
      `- ${interpolate(output.template ?? "{{ value }}", { value: answer.value ?? "" })}`,
    ];
  if (output.kind === "selected_values_bullets")
    return [
      ...(answer.values ?? []).map(
        (id) =>
          `- ${question.options?.find((item) => item.id === id)?.label ?? id}`,
      ),
    ];
  if (output.kind === "selected_option_bullets")
    return [
      ...(output.lead ? [output.lead] : []),
      ...(answer.values ?? [])
        .filter((id) => question.options?.some((item) => item.id === id))
        .map(
          (id) =>
            `- ${
              question.options?.find((item) => item.id === id)?.markdown ?? id
            }`,
        ),
      ...custom.map((value) => `- ${value}`),
    ];
  if (output.kind === "bullets")
    return [
      ...(output.lead ? [output.lead] : []),
      ...(answer.values ?? []).map((value) => `- ${value}`),
    ];
  if (output.kind === "pair_bullets")
    return (answer.pairs ?? []).map(
      (pair) => `- ${interpolate(output.template ?? "", pair)}`,
    );
  if (output.kind === "command_block" || output.kind === "command_list") {
    const values =
      output.kind === "command_list"
        ? (answer.values ?? [])
        : [
            interpolate(output.template ?? "{{ value }}", {
              value: answer.value ?? "",
            }),
          ];
    return [
      ...(output.lead ? [output.lead, ""] : []),
      `\`\`\`${output.language ?? ""}`,
      ...values,
      "```",
    ];
  }
  if (option?.markdown) return [option.markdown];
  return [];
}
export function renderMarkdown(catalog: Catalog, answers: Answers): string {
  const sections = new Map<string, string[]>();
  for (const [id, answer] of answers) {
    if (answer.answerId === "skipped") continue;
    const question = catalog.questions[id];
    const output = outputFor(question, answer);
    if (!output) continue;
    const content = body(question, answer, output);
    if (content.length)
      sections.set(output.section, [
        ...(sections.get(output.section) ?? []),
        content.join("\n"),
      ]);
  }
  return Object.entries(catalog.sections)
    .sort(([, a], [, b]) => a.order - b.order)
    .flatMap(([id, section]) => {
      const content = sections.get(id);
      return content?.length ? [`## ${section.title}`, ...content] : [];
    })
    .join("\n\n")
    .concat(sections.size ? "\n" : "");
}
