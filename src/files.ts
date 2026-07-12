import { randomUUID } from "node:crypto";
import { lstat, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function assertAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    throw new Error(
      `${path} already exists; agents-wizard only creates new files.`,
    );
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
export async function writeOutputs(
  markdownPath: string,
  statePath: string,
  markdown: string,
  state: string,
): Promise<void> {
  await assertAbsent(markdownPath);
  const dir = dirname(markdownPath);
  const markTmp = join(dir, `.${randomUUID()}.tmp`);
  const stateTmp = join(dir, `.${randomUUID()}.tmp`);
  try {
    await writeFile(markTmp, markdown, "utf8");
    await writeFile(stateTmp, state, "utf8");
    await assertAbsent(markdownPath);
    await rename(stateTmp, statePath);
    await rename(markTmp, markdownPath);
  } catch (error) {
    await Promise.allSettled([
      rm(markTmp, { force: true }),
      rm(stateTmp, { force: true }),
      rm(markdownPath, { force: true }),
    ]);
    throw error;
  }
}
