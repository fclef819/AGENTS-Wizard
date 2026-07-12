import { styleText } from "node:util";
import {
  createPrompt,
  isDownKey,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  makeTheme,
  useKeypress,
  usePagination,
  usePrefix,
  useState,
} from "@inquirer/core";

type Item =
  | { kind: "choice"; value: string; name: string }
  | { kind: "action"; value: string; name: string };
export type CheckboxActionResult =
  | { type: "answers"; values: string[] }
  | { type: "navigation"; value: string };

interface Config {
  message: string;
  choices: { value: string; name: string }[];
  actions: { value: string; name: string }[];
  required?: boolean;
  pageSize?: number;
}

const prompt = createPrompt<CheckboxActionResult, Config>((config, done) => {
  const theme = makeTheme();
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const prefix = usePrefix({ status, theme });
  const items: Item[] = [
    ...config.choices.map((choice) => ({
      ...choice,
      kind: "choice" as const,
    })),
    ...config.actions.map((action) => ({
      ...action,
      kind: "action" as const,
    })),
  ];
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const toggle = (value: string) =>
    setSelected(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );

  useKeypress((key) => {
    if (isUpKey(key, theme.keybindings)) {
      setActive((active + items.length - 1) % items.length);
      setError(undefined);
    } else if (isDownKey(key, theme.keybindings)) {
      setActive((active + 1) % items.length);
      setError(undefined);
    } else if (isSpaceKey(key)) {
      const item = items[active];
      if (item?.kind === "choice") toggle(item.value);
    } else if (isEnterKey(key)) {
      const item = items[active];
      if (!item) return;
      if (item.kind === "choice") {
        if (config.required && selected.length === 0) {
          setError("1つ以上選択してください。");
          return;
        }
        setStatus("done");
        done({ type: "answers", values: selected });
        return;
      }
      setStatus("done");
      done({ type: "navigation", value: item.value });
    }
  });

  const page = usePagination({
    items,
    active,
    pageSize: config.pageSize ?? 12,
    loop: true,
    renderItem({ item, isActive }) {
      const cursor = isActive ? styleText("cyan", "❯") : " ";
      if (item.kind === "action") {
        const button = `[ ${item.name} ]`;
        return `${cursor} ${isActive ? styleText("cyan", button) : button}`;
      }
      const mark = selected.includes(item.value)
        ? styleText("green", "◉")
        : "◯";
      return `${cursor}${mark} ${isActive ? styleText("cyan", item.name) : item.name}`;
    },
  });
  const message = theme.style.message(config.message, status);
  if (status === "done")
    return `${prefix} ${message} ${theme.style.answer(selected.join(", "))}`;
  return [
    `${prefix} ${message}`,
    page,
    error ? theme.style.error(error) : undefined,
    styleText("dim", "↑↓ 移動 • Space 選択 • Enter 確定／実行"),
  ]
    .filter(Boolean)
    .join("\n");
});

export async function checkboxWithActions(
  config: Config,
): Promise<CheckboxActionResult> {
  return prompt(config);
}
