import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
const directory = await mkdtemp(
  fileURLToPath(new URL("../node_modules/.localchat-test-", import.meta.url)),
);
try {
  const source = await readFile(
    new URL("../src/composables/useUpload.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  });
  const modulePath = `${directory}/useUpload.mjs`;
  await writeFile(modulePath, outputText);
  const presentationSource = await readFile(
    new URL("../src/presentation/messages.ts", import.meta.url),
    "utf8",
  );
  const presentationPath = `${directory}/messages.mjs`;
  await writeFile(
    presentationPath,
    ts.transpileModule(presentationSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  );
  const soundSource = await readFile(
    new URL("../src/composables/useNotificationSound.ts", import.meta.url),
    "utf8",
  );
  const soundPath = `${directory}/useNotificationSound.mjs`;
  await writeFile(
    soundPath,
    ts.transpileModule(soundSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  );
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      fileURLToPath(new URL("../tests/upload.test.mjs", import.meta.url)),
      fileURLToPath(new URL("../tests/presentation.test.mjs", import.meta.url)),
      fileURLToPath(new URL("../tests/sound.test.mjs", import.meta.url)),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        LOCALCHAT_UPLOAD_MODULE: pathToFileURL(modulePath).href,
        LOCALCHAT_PRESENTATION_MODULE: pathToFileURL(presentationPath).href,
        LOCALCHAT_SOUND_MODULE: pathToFileURL(soundPath).href,
      },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
