/** Empacotamento estático: não instala dependências e não inclui testes. */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL(".", import.meta.url));
const target = path.resolve(source, "../dist");
const files = ["index.html", "styles.css", "app.js", "core.js", "shield.svg"];
for (const file of files)
  if (
    !existsSync(path.join(source, file)) ||
    !lstatSync(path.join(source, file)).isFile()
  )
    throw new Error(`Arquivo estático ausente: ${file}`);
const dataFiles = readdirSync(path.join(source, "data"));
for (const file of dataFiles)
  if (
    !/^[a-z0-9-]+\.(csv|json|jsonl)$/.test(file) ||
    !lstatSync(path.join(source, "data", file)).isFile()
  )
    throw new Error(
      "A pasta data deve conter somente os exemplos estáticos previstos.",
    );
rmSync(target, { recursive: true, force: true });
mkdirSync(path.join(target, "data"), { recursive: true });
for (const file of files)
  cpSync(path.join(source, file), path.join(target, file));
for (const file of dataFiles)
  cpSync(path.join(source, "data", file), path.join(target, "data", file));
console.log(
  JSON.stringify({
    directory: target,
    files: files.length + dataFiles.length,
    build: "static",
  }),
);
