export const MAX_BYTES = 2 * 1024 * 1024;
const fail = (message) => { throw new Error(message); };

export function strictJSON(source) {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > MAX_BYTES
  )
    fail("Use um JSON UTF-8 de até 2 MB.");
  let pos = 0,
    tokens = 0;
  const space = () => {
    while (/[ \t\r\n]/.test(source[pos] ?? "") && pos < source.length) pos++;
  };
  const string = () => {
    const start = pos++;
    while (pos < source.length) {
      if (source[pos] === "\\") {
        pos += 2;
        continue;
      }
      if (source[pos++] === '"') {
        try {
          return JSON.parse(source.slice(start, pos));
        } catch {
          fail("Texto JSON inválido.");
        }
      }
    }
    fail("Texto JSON sem fechamento.");
  };
  function value(depth = 0) {
    if (depth > 20 || ++tokens > 300000) fail("JSON muito complexo.");
    space();
    const ch = source[pos];
    if (ch === '"') return string();
    if (ch === "{") {
      pos++;
      const object = Object.create(null);
      space();
      if (source[pos] === "}") {
        pos++;
        return object;
      }
      while (pos < source.length) {
        space();
        if (source[pos] !== '"') fail("Chave JSON inválida.");
        const key = string();
        if (Object.hasOwn(object, key)) fail(`Chave JSON repetida: ${key}.`);
        space();
        if (source[pos++] !== ":") fail("JSON inválido.");
        object[key] = value(depth + 1);
        space();
        const end = source[pos++];
        if (end === "}") return object;
        if (end !== ",") fail("JSON inválido.");
      }
    } else if (ch === "[") {
      pos++;
      const array = [];
      space();
      if (source[pos] === "]") {
        pos++;
        return array;
      }
      while (pos < source.length) {
        array.push(value(depth + 1));
        space();
        const end = source[pos++];
        if (end === "]") return array;
        if (end !== ",") fail("JSON inválido.");
      }
    } else {
      for (const [literal, result] of [
        ["true", true],
        ["false", false],
        ["null", null],
      ])
        if (source.startsWith(literal, pos)) {
          pos += literal.length;
          return result;
        }
      const match = source
        .slice(pos)
        .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match) {
        pos += match[0].length;
        const number = Number(match[0]);
        if (!Number.isFinite(number)) fail("Número JSON fora do limite.");
        return number;
      }
    }
    fail("JSON inválido ou incompleto.");
  }
  source = source.replace(/^\uFEFF/, "");
  const result = value();
  space();
  if (pos !== source.length) fail("Há conteúdo depois do JSON.");
  return result;
}

/** CSV RFC 4180: aspas escapadas, quebras em campos e limites antes de alocar. */
