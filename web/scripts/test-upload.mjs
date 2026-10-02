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
  const featureModules = {};
  for (const name of ["longText", "preview"]) {
    const source = await readFile(
      new URL(`../src/presentation/${name}.ts`, import.meta.url),
      "utf8",
    );
    const path = `${directory}/${name}.mjs`;
    await writeFile(
      path,
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    );
    featureModules[name] = pathToFileURL(path).href;
  }
  const i18nPath = `${directory}/i18n.mjs`;
  await writeFile(
    i18nPath,
    ts.transpileModule(
      await readFile(new URL("../src/i18n.ts", import.meta.url), "utf8"),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
    ).outputText,
  );
  const notificationPath = `${directory}/useNotification.mjs`;
  const notificationSource = await readFile(
    new URL("../src/composables/useNotification.ts", import.meta.url),
    "utf8",
  );
  await writeFile(
    notificationPath,
    ts.transpileModule(notificationSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  );
  const websocketPath = `${directory}/useWebSocket.mjs`;
  const websocketSource = await readFile(
    new URL("../src/composables/useWebSocket.ts", import.meta.url),
    "utf8",
  );
  await writeFile(
    websocketPath,
    ts
      .transpileModule(websocketSource, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace('"./useNotification"', '"./useNotification.mjs"')
      .replace('"../presentation/longText"', '"./longText.mjs"'),
  );
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      fileURLToPath(new URL("../tests/upload.test.mjs", import.meta.url)),
      fileURLToPath(new URL("../tests/presentation.test.mjs", import.meta.url)),
      fileURLToPath(new URL("../tests/long-text.test.mjs", import.meta.url)),
      fileURLToPath(new URL("../tests/notification.test.mjs", import.meta.url)),
      fileURLToPath(new URL("../tests/i18n.test.mjs", import.meta.url)),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        LOCALCHAT_I18N_MODULE: pathToFileURL(i18nPath).href,
        LOCALCHAT_NOTIFICATION_MODULE: pathToFileURL(notificationPath).href,
        LOCALCHAT_WEBSOCKET_MODULE: pathToFileURL(websocketPath).href,
        LOCALCHAT_UPLOAD_MODULE: pathToFileURL(modulePath).href,
        LOCALCHAT_PRESENTATION_MODULE: pathToFileURL(presentationPath).href,
        LOCALCHAT_LONG_TEXT_MODULE: featureModules.longText,
        LOCALCHAT_PREVIEW_MODULE: featureModules.preview,
      },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
