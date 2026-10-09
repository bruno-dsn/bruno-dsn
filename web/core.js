/** Regras didáticas, sem rede, sem IA e sem modificações em sistemas. */
export const FIELDS = [
  "event_id",
  "timestamp",
  "origem",
  "usuario",
  "ip",
  "sessao",
  "acao",
  "resultado",
  "recurso",
  "valor_brl",
];
export const NOTE_FIELDS = [
  "observacoes",
  "hipoteses",
  "pendencias",
  "contencao",
];
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_SIGNALS = 1000;
export const MAX_EVIDENCE = 50;
export const FIELD_GUIDE = {
  event_id: [
    "Qual registro?",
    "É o identificador do evento. Use-o nas anotações para que outra pessoa encontre a mesma evidência.",
  ],
  timestamp: [
    "Quando?",
    "É a data e hora informada pelo sistema. Aqui usamos UTC. Confirme se os relógios das fontes estavam sincronizados.",
  ],
  origem: [
    "Qual sistema?",
    "É a categoria da fonte. Um registro de rede e um do financeiro podem descrever coisas diferentes.",
  ],
  usuario: [
    "Qual conta?",
    "É a conta informada pelo sistema. O nome da conta, sozinho, não identifica a pessoa que a usou.",
  ],
  ip: [
    "Qual endereço?",
    "É o endereço informado pela fonte. VPN, NAT e proxies podem fazer várias pessoas usarem o mesmo IP.",
  ],
  sessao: [
    "Qual sessão?",
    "Agrupa eventos conforme a definição do sistema. IDs iguais em fontes diferentes só indicam vínculo depois de confirmar o namespace. Use um identificador de correlação; nunca importe cookies ou tokens ativos.",
  ],
  acao: [
    "O que foi feito?",
    "É a operação registrada: login, transferencia ou outra ação. Confira o significado na documentação da fonte.",
  ],
  resultado: [
    "Qual resultado?",
    "Sucesso significa que a fonte informou sucesso. Não confirma aprovação legítima, liquidação bancária ou ausência de fraude.",
  ],
  recurso: [
    "Em qual recurso?",
    "É o alvo da ação: serviço, dispositivo ou favorecido. Esse campo pode conter informação sensível.",
  ],
  valor_brl: [
    "Qual valor?",
    "São os reais informados no evento. Um campo vazio significa valor desconhecido, não zero. Confira a conciliação antes de estimar prejuízo.",
  ],
};

const fail = (message) => {
  throw new Error(message);
};
const exactKeys = (object, keys) =>
  object &&
  typeof object === "object" &&
  !Array.isArray(object) &&
  Object.keys(object).length === keys.length &&
  keys.every((k) => Object.hasOwn(object, k));
const text = (value, max = 200) =>
  typeof value === "string" && value.length <= max;

/** JSON com chaves únicas, profundidade limitada e números finitos. */
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
export function parseCSV(source, maxRows = 10000) {
  source = source.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    cell = "",
    state = "start";
  const addCell = () => {
    if (cell.length > 200) fail("Cada campo pode ter até 200 caracteres.");
    row.push(cell);
    cell = "";
    state = "start";
  };
  const addRow = () => {
    addCell();
    if (row.length !== 1 || row[0] !== "") rows.push(row);
    row = [];
    if (rows.length > maxRows + 1)
      fail(`Use até ${maxRows.toLocaleString("pt-BR")} registros.`);
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (state === "quoted") {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else state = "after";
      } else cell += ch;
    } else if (ch === ",") addCell();
    else if (ch === "\r" || ch === "\n") {
      addRow();
      if (ch === "\r" && source[i + 1] === "\n") i++;
    } else if (ch === '"') {
      if (state !== "start") fail("Aspas fora de posição no CSV.");
      state = "quoted";
    } else {
      if (state === "after") fail("Conteúdo inesperado após as aspas do CSV.");
      cell += ch;
      state = "plain";
    }
    if (cell.length > 200 || row.length > 32)
      fail("Campo ou quantidade de colunas acima do limite.");
  }
  if (state === "quoted") fail("O CSV termina com aspas abertas.");
  if (row.length || cell || state === "after") addRow();
  if (!rows.length) fail("O CSV está vazio.");
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length)
    fail("Colunas repetidas no CSV.");
  return {
    headers,
    rows: rows.map((r, i) => {
      if (r.length !== headers.length)
        fail(
          `Registro ${i + 1}: quantidade de colunas diferente do cabeçalho.`,
        );
      return Object.fromEntries(headers.map((k, j) => [k, r[j]]));
    }),
  };
}

export function ipAddress(input) {
  if (
    typeof input !== "string" ||
    input.length > 45 ||
    !input ||
    input.includes("%")
  )
    fail("Endereço IPv4 ou IPv6 inválido.");
  if (!input.includes(":")) {
    const octets = input.split(".");
    if (
      octets.length !== 4 ||
      octets.some((o) => !/^(0|[1-9]\d{0,2})$/.test(o) || Number(o) > 255)
    )
      fail("Endereço IPv4 inválido.");
    return {
      version: 4,
      bits: 32,
      value: octets.reduce((n, o) => (n << 8n) + BigInt(o), 0n),
      canonical: octets.join("."),
    };
  }
  let raw = input.toLowerCase();
  if (raw.includes(".")) {
    const last = raw.lastIndexOf(":");
    const tail = ipAddress(raw.slice(last + 1));
    if (tail.version !== 4) fail("Endereço IPv6 inválido.");
    raw =
      raw.slice(0, last + 1) +
      (tail.value >> 16n).toString(16) +
      ":" +
      (tail.value & 65535n).toString(16);
  }
  if ((raw.match(/::/g) || []).length > 1) fail("Endereço IPv6 inválido.");
  let parts;
  if (raw.includes("::")) {
    const [l, r] = raw.split("::"),
      left = l ? l.split(":") : [],
      right = r ? r.split(":") : [];
    const count = 8 - left.length - right.length;
    if (count < 1) fail("Endereço IPv6 inválido.");
    parts = [...left, ...Array(count).fill("0"), ...right];
  } else parts = raw.split(":");
  if (parts.length !== 8 || parts.some((p) => !/^[0-9a-f]{1,4}$/.test(p)))
    fail("Endereço IPv6 inválido.");
  const values = parts.map((p) => parseInt(p, 16));
  return {
    version: 6,
    bits: 128,
    value: values.reduce((n, v) => (n << 16n) + BigInt(v), 0n),
    canonical: formatIP(
      values.reduce((n, v) => (n << 16n) + BigInt(v), 0n),
      6,
    ),
  };
}

function formatIP(value, version) {
  if (version === 4)
    return [24n, 16n, 8n, 0n]
      .map((shift) => Number((value >> shift) & 255n))
      .join(".");
  const parts = Array.from({ length: 8 }, (_, i) =>
    Number((value >> BigInt((7 - i) * 16)) & 65535n).toString(16),
  );
  let start = -1,
    best = 0;
  for (let i = 0; i < 8;) {
    if (parts[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && parts[j] === "0") j++;
    if (j - i > best) {
      start = i;
      best = j - i;
    }
    i = j;
  }
  if (best < 2) return parts.join(":");
  return (
    parts.slice(0, start).join(":") + "::" + parts.slice(start + best).join(":")
  );
}

function instant(timestamp) {
  const match = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match)
    fail(
      "Use data e hora ISO 8601 com fuso explícito, como 2026-10-08T12:00:00Z.",
    );
  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
    fraction = "",
    zone,
    sign,
    oh = "0",
    om = "0",
  ] = match;
  const [y, m, d, h, min, s] = [year, month, day, hour, minute, second].map(
    Number,
  );
  if (
    y < 1 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    h > 23 ||
    min > 59 ||
    s > 59 ||
    Number(oh) > 23 ||
    Number(om) > 59
  )
    fail("Data, hora ou fuso inválidos.");
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(h, min, s, 0);
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    fail("Data inválida.");
  const offset =
    zone === "Z"
      ? 0
      : (sign === "-" ? -1 : 1) * (Number(oh) * 60 + Number(om)) * 60000;
  const ms = date.getTime() - offset;
  const utc = new Date(ms);
  if (utc.getUTCFullYear() < 1 || utc.getUTCFullYear() > 9999)
    fail("Data UTC fora do limite.");
  const us = BigInt(ms) * 1000n + BigInt(fraction.padEnd(6, "0"));
  return {
    us,
    canonical:
      utc.toISOString().slice(0, 19) +
      (fraction ? "." + fraction.padEnd(6, "0") : "") +
      "+00:00",
  };
}

export function amountCents(value) {
  if (value === "") return null;
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value))
    fail(
      "valor_brl deve ser não negativo e ter até duas casas decimais, como 15000.00.",
    );
  const [integer, decimal = ""] = value.split(".");
  const cents = BigInt(integer) * 100n + BigInt(decimal.padEnd(2, "0"));
  if (cents > 100000000000000n)
    fail("valor_brl acima do limite de 1 trilhão de reais por evento.");
  return cents;
}

export async function parseEvents(bytes, format = "csv") {
  if (
    !(bytes instanceof Uint8Array) ||
    !bytes.length ||
    bytes.length > MAX_BYTES
  )
    fail("Use um arquivo UTF-8 de até 2 MB.");
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("O arquivo precisa usar UTF-8.");
  }
  let rows;
  if (format === "csv") {
    const csv = parseCSV(source);
    if (
      csv.headers.length !== FIELDS.length ||
      !FIELDS.every((f) => csv.headers.includes(f))
    )
      fail("Use as dez colunas exatas do caso de exemplo.");
    rows = csv.rows;
  } else if (format === "jsonl") {
    const lines = source
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((l) => l.trim());
    if (lines.length > 10000) fail("Use até 10.000 eventos.");
    rows = lines.map((line, i) => {
      try {
        return strictJSON(line);
      } catch (e) {
        fail(`Linha ${i + 1}: ${e.message}`);
      }
    });
  } else fail("Escolha CSV ou JSONL.");
  if (!rows.length) fail("O arquivo precisa conter pelo menos um evento.");
  const ids = new Set();
  const events = rows.map((row, i) => {
    if (!exactKeys(row, FIELDS) || !Object.values(row).every((v) => text(v)))
      fail(`Registro ${i + 1}: campos inválidos ou acima de 200 caracteres.`);
    const event = Object.fromEntries(FIELDS.map((k) => [k, row[k].trim()]));
    if (!event.event_id || ids.has(event.event_id))
      fail(`Registro ${i + 1}: cada evento precisa de um ID único.`);
    ids.add(event.event_id);
    try {
      const time = instant(event.timestamp);
      event.timestamp = time.canonical;
      Object.defineProperty(event, "instantUs", { value: time.us });
      if (
        !["autenticacao", "identidade", "financeiro", "rede"].includes(
          event.origem,
        ) ||
        !["sucesso", "falha", "negado", "informativo"].includes(
          event.resultado,
        ) ||
        !event.acao
      )
        fail("Origem, resultado ou ação fora do contrato.");
      if (event.ip) event.ip = ipAddress(event.ip).canonical;
      event.valor_centavos = amountCents(event.valor_brl);
    } catch (e) {
      fail(`Registro ${i + 1}: ${e.message}`);
    }
    return event;
  });
  events.sort((a, b) =>
    a.instantUs < b.instantUs
      ? -1
      : a.instantUs > b.instantUs
        ? 1
        : a.event_id < b.event_id
          ? -1
          : a.event_id > b.event_id
            ? 1
            : 0,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    events,
    sha256: Array.from(new Uint8Array(digest), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join(""),
    bytes: bytes.length,
  };
}

export function investigate(parsed, threshold = 15000, shared = false) {
  if (
    !Number.isSafeInteger(threshold) ||
    threshold < 1 ||
    threshold > 1000000000 ||
    typeof shared !== "boolean"
  )
    fail("Limiar ou confirmação de sessões inválidos.");
  const { events } = parsed;
  const signals = [],
    windows = new Map(),
    seen = new Map(),
    sessions = new Map();
  let count = 0;
  function signal(label, evidence, hypothesis, alternative, next, omitted = 0) {
    count++;
    if (signals.length >= MAX_SIGNALS) return;
    omitted += Math.max(0, evidence.length - MAX_EVIDENCE);
    evidence = evidence.slice(-MAX_EVIDENCE);
    signals.push({
      sinal: label,
      event_ids: evidence.map((e) => e.event_id),
      evidencias_omitidas: omitted,
      observacao: evidence
        .map((e) => `${e.timestamp} · ${e.acao} · ${e.resultado}`)
        .join("; "),
      hipotese: hypothesis,
      explicacao_alternativa: alternative,
      proxima_verificacao: next,
    });
  }
  for (const event of events) {
    if (shared && event.usuario && event.sessao) {
      const key = JSON.stringify([event.usuario, event.sessao]);
      if (!sessions.has(key)) sessions.set(key, []);
      sessions.get(key).push(event);
    }
    if (
      event.origem === "autenticacao" &&
      event.acao === "login" &&
      event.usuario &&
      event.ip
    ) {
      const key = JSON.stringify([event.usuario, event.ip]);
      if (!windows.has(key)) windows.set(key, { events: [], start: 0 });
      const queue = windows.get(key);
      while (
        queue.start < queue.events.length &&
        event.instantUs - queue.events[queue.start].instantUs > 600000000n
      )
        queue.start++;
      if (event.resultado === "falha") queue.events.push(event);
      if (event.resultado === "sucesso") {
        const length = queue.events.length - queue.start;
        if (length >= 5)
          signal(
            "Login após falhas concentradas",
            [
              ...queue.events.slice(
                Math.max(queue.start, queue.events.length - 49),
              ),
              event,
            ],
            "Um acesso precisa de investigação após pelo menos cinco falhas em dez minutos.",
            "A pessoa pode ter esquecido a senha ou usado um cliente mal configurado.",
            "Confirmar a legitimidade do acesso por um canal conhecido e conferir os registros do provedor.",
            Math.max(0, length - 49),
          );
        if (!seen.has(event.usuario)) seen.set(event.usuario, new Map());
        const ips = seen.get(event.usuario);
        if (ips.size && !ips.has(event.ip))
          signal(
            "Origem não vista antes neste arquivo",
            [ips.values().next().value, event],
            "A conta foi usada a partir de um IP diferente dos sucessos anteriores presentes no recorte.",
            "VPN, provedor móvel ou trabalho remoto podem explicar a mudança. O recorte pode estar incompleto.",
            "Revisar contexto, dispositivo, MFA e a extensão do histórico disponível.",
          );
        if (!ips.has(event.ip)) ips.set(event.ip, event);
      }
    }
    if (
      event.origem === "identidade" &&
      event.acao === "mfa_desativado" &&
      event.resultado === "sucesso"
    )
      signal(
        "MFA desativado",
        [event],
        "Uma proteção da conta foi alterada no período investigado.",
        "Pode ter sido uma recuperação de conta aprovada pelo suporte.",
        "Conferir autorização, responsável, dispositivo e registro original da alteração.",
      );
    if (
      event.origem === "financeiro" &&
      event.acao === "transferencia" &&
      event.resultado === "sucesso" &&
      event.valor_centavos !== null &&
      event.valor_centavos >= BigInt(threshold) * 100n
    )
      signal(
        "Transferência acima do limiar escolhido",
        [event],
        "A operação ultrapassa o limiar de triagem escolhido para este exercício.",
        "Uma transferência alta pode fazer parte da rotina e ter aprovação legítima.",
        "Conferir favorecido, aprovação, conciliação e confirmação com a equipe financeira.",
      );
  }
  for (const group of sessions.values()) {
    const changes = [];
    let start = 0;
    for (const event of group) {
      while (
        start < changes.length &&
        event.instantUs - changes[start].instantUs > 1800000000n
      )
        start++;
      if (
        event.resultado === "sucesso" &&
        ((event.origem === "identidade" && event.acao === "mfa_desativado") ||
          (event.origem === "financeiro" &&
            event.acao === "alteracao_favorecido"))
      )
        changes.push(event);
      if (
        changes.length > start &&
        event.origem === "financeiro" &&
        event.acao === "transferencia" &&
        event.resultado === "sucesso"
      ) {
        const related = changes.slice(Math.max(start, changes.length - 49));
        signal(
          "Alteração e transferência na mesma sessão",
          [...related, event],
          `Os registros compartilham a sessão ${event.sessao} e ocorreram em até trinta minutos. Isso sustenta a investigação conjunta desses eventos.`,
          "A própria equipe pode ter feito a alteração e a transferência com autorização.",
          "Confirmar como cada sistema define o ID de sessão, consultar aprovação e preservar os registros originais. IDs iguais de sistemas sem namespace compartilhado não provam vínculo.",
          Math.max(0, changes.length - start - related.length),
        );
      }
    }
  }
  const transfers = events.filter(
    (e) =>
      e.origem === "financeiro" &&
      e.acao === "transferencia" &&
      e.resultado === "sucesso",
  );
  return {
    ...parsed,
    signals,
    signal_count: count,
    signals_omitted: Math.max(0, count - MAX_SIGNALS),
    threshold_brl: threshold,
    shared_session_namespace: shared,
    transfer_count: transfers.length,
    transfer_total_centavos: transfers.reduce(
      (n, e) => n + (e.valor_centavos ?? 0n),
      0n,
    ),
    transfers_without_amount: transfers.filter((e) => e.valor_centavos === null)
      .length,
  };
}

export function money(cents) {
  const value = BigInt(cents),
    positive = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}R$ ${(positive / 100n).toLocaleString("pt-BR")},${(positive % 100n).toString().padStart(2, "0")}`;
}
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
export function safeCSV(rows, fields = FIELDS) {
  const cell = (value) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      fields.map(cell).join(","),
      ...rows.map((r) => fields.map((f) => cell(r[f])).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}

export function makeNotebook(result, notes, caseName) {
  const object = {
    schema_version: 1,
    caso: caseName,
    arquivo_sha256: result.sha256,
    bytes: result.bytes,
    ids_eventos: result.events.map((e) => e.event_id),
    limiar_transferencia_brl: result.threshold_brl,
    ids_sessao_compativeis: result.shared_session_namespace,
    notas: notes,
  };
  restoreNotebook(JSON.stringify(object), result);
  return object;
}
export function restoreNotebook(source, result) {
  const n = strictJSON(source);
  const keys = [
    "schema_version",
    "caso",
    "arquivo_sha256",
    "bytes",
    "ids_eventos",
    "limiar_transferencia_brl",
    "ids_sessao_compativeis",
    "notas",
  ];
  if (!exactKeys(n, keys) || n.schema_version !== 1)
    fail("Formato ou versão de caderno não reconhecidos.");
  if (n.arquivo_sha256 !== result.sha256 || n.bytes !== result.bytes)
    fail(
      "Este caderno pertence a outros bytes. Abra o arquivo original desta investigação primeiro.",
    );
  if (
    !Array.isArray(n.ids_eventos) ||
    n.ids_eventos.length !== result.events.length ||
    !n.ids_eventos.every((id, i) => id === result.events[i].event_id)
  )
    fail("Os IDs do caderno não correspondem à linha do tempo atual.");
  if (
    !text(n.caso, 100) ||
    !n.caso ||
    !Number.isSafeInteger(n.limiar_transferencia_brl) ||
    n.limiar_transferencia_brl < 1 ||
    n.limiar_transferencia_brl > 1000000000 ||
    typeof n.ids_sessao_compativeis !== "boolean"
  )
    fail("Parâmetros do caderno inválidos.");
  if (
    !exactKeys(n.notas, NOTE_FIELDS) ||
    !Object.values(n.notas).every((v) => text(v, 3000))
  )
    fail("Use as quatro notas, cada uma com até 3.000 caracteres.");
  return n;
}

export function investigationHTML(result, notes, caseName) {
  makeNotebook(result, notes, caseName);
  const e = escapeHTML;
  const noteLabels = [
    "Observações e IDs",
    "Hipóteses e alternativas",
    "Evidências pendentes",
    "Contenção proposta",
  ];
  const notesHTML = NOTE_FIELDS.map(
    (f, i) =>
      `<h2>${noteLabels[i]}</h2><p class="note">${e(notes[f]) || "Sem anotação."}</p>`,
  ).join("");
  const signals = result.signals
    .map(
      (s) =>
        `<article><h3>${e(s.sinal)}</h3><p>IDs: ${e(s.event_ids.join(", "))} · evidências omitidas: ${s.evidencias_omitidas}</p><p><b>Observação:</b> ${e(s.observacao)}</p><p><b>Hipótese:</b> ${e(s.hipotese)}</p><p><b>Alternativa:</b> ${e(s.explicacao_alternativa)}</p><p><b>Verificar:</b> ${e(s.proxima_verificacao)}</p></article>`,
    )
    .join("");
  const rows = result.events
    .map(
      (event) =>
        "<tr>" +
        ["event_id", "timestamp", "origem", "usuario", "acao", "resultado"]
          .map((f) => `<td>${e(event[f])}</td>`)
          .join("") +
        "</tr>",
    )
    .join("");
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>NetGuard Lab · Caderno</title><style>body{font:16px/1.6 system-ui;color:#1b231d;background:#fffdf6;max-width:1000px;margin:40px auto;padding:0 24px}h1,h2{color:#2f6b3f}article{border:1px solid #d1c09f;padding:16px;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #d1c09f;text-align:left;padding:8px;overflow-wrap:anywhere}.note{white-space:pre-wrap}code{overflow-wrap:anywhere}@media print{body{margin:0;padding:0}article{break-inside:avoid}thead{display:table-header-group}}</style><h1>NetGuard Lab · ${e(caseName)}</h1><p>${result.events.length} eventos; ${result.signal_count} sinais pelas regras; ${result.signals_omitted} sinais omitidos. Limiar: ${money(BigInt(result.threshold_brl) * 100n)}. Sessões compatíveis: ${result.shared_session_namespace ? "sim" : "não"}.</p><p>SHA-256 dos ${result.bytes} bytes recebidos: <code>${result.sha256}</code>. O hash identifica os bytes; não comprova origem ou autenticidade.</p><p>Logs e sinais não confirmam autoria, invasão ou prejuízo. Consulte registros originais e a equipe responsável. Este relatório contém dados e anotações: revise antes de compartilhar.</p>${notesHTML}<h2>Sinais e hipóteses</h2>${signals || "<p>Nenhum sinal nas regras deste exercício.</p>"}<h2>Linha do tempo em UTC</h2><table><thead><tr><th>ID</th><th>Horário</th><th>Fonte</th><th>Conta</th><th>Ação</th><th>Resultado</th></tr></thead><tbody>${rows}</tbody></table></html>`;
}

export function assessment(controls, answers, notes = {}) {
  const states = ["unknown", "absent", "partial", "implemented", "na"];
  const ids = new Set(controls.map((c) => c.id));
  if (
    Object.keys(answers).some((k) => !ids.has(k)) ||
    Object.keys(notes).some((k) => !ids.has(k))
  )
    fail("Controle desconhecido no diagnóstico.");
  let numerator = 0,
    denominator = 0,
    unknown = 0,
    implemented = 0,
    applicable = 0;
  const tasks = [],
    areas = new Map();
  for (const c of controls) {
    const state = answers[c.id] ?? "unknown",
      note = notes[c.id] ?? "";
    if (!states.includes(state) || !text(note, 1000))
      fail("Resposta ou evidência inválida no diagnóstico.");
    if (state === "na") {
      if (!note.trim()) fail(`Justifique por que ${c.title} não se aplica.`);
      continue;
    }
    applicable++;
    denominator += c.weight;
    numerator +=
      c.weight * (state === "implemented" ? 1 : state === "partial" ? 0.5 : 0);
    unknown += Number(state === "unknown");
    implemented += Number(state === "implemented");
    if (!areas.has(c.area))
      areas.set(c.area, { area: c.area, total: 0, met: 0 });
    const area = areas.get(c.area);
    area.total += c.weight;
    area.met +=
      c.weight * (state === "implemented" ? 1 : state === "partial" ? 0.5 : 0);
    if (state !== "implemented" || !note.trim())
      tasks.push({
        ...c,
        state,
        priority: c.weight >= 4 ? "Alta" : "Planejar",
        action:
          state === "unknown"
            ? `Confirmar a situação: ${c.action}`
            : state === "implemented"
              ? `Revisar e registrar evidência: ${c.evidence}`
              : c.action,
      });
  }
  tasks.sort(
    (a, b) =>
      b.weight - a.weight || a.days - b.days || a.id.localeCompare(b.id),
  );
  return {
    score: denominator
      ? Math.round((numerator / denominator) * 1000) / 10
      : null,
    unknown,
    implemented,
    applicable,
    tasks,
    areas: [...areas.values()].map((a) => ({
      ...a,
      score: Math.round((a.met / a.total) * 100),
    })),
  };
}

const INVENTORY_FIELDS = [
  "id",
  "nome",
  "tipo",
  "zona",
  "ip",
  "exposto_internet",
  "mfa",
  "atualizado",
  "backup_testado",
  "portas",
];
export function inventory(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BYTES)
    fail("Use um inventário de até 2 MB.");
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("O inventário precisa usar UTF-8.");
  }
  const parsed = parseCSV(source, 500);
  if (
    parsed.headers.length !== 10 ||
    !INVENTORY_FIELDS.every((f) => parsed.headers.includes(f))
  )
    fail("Use as dez colunas do inventário de exemplo.");
  return normalizeAssets(parsed.rows);
}
export function normalizeAssets(rows) {
  if (!Array.isArray(rows) || rows.length > 500) fail("Use até 500 ativos.");
  const ids = new Set();
  return rows.map((row, i) => {
    if (
      !exactKeys(row, INVENTORY_FIELDS) ||
      !Object.values(row).every((v) => text(v))
    )
      fail(`Ativo ${i + 1}: campos inválidos.`);
    const r = Object.fromEntries(
      INVENTORY_FIELDS.map((k) => [k, row[k].trim()]),
    );
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(r.id) || ids.has(r.id) || !r.nome)
      fail("Cada ativo precisa de um ID único e um nome.");
    ids.add(r.id);
    if (
      ![
        "computador",
        "servidor",
        "roteador",
        "switch",
        "iot",
        "nuvem",
        "email",
      ].includes(r.tipo) ||
      ![
        "administracao",
        "interna",
        "servidores",
        "visitantes",
        "iot",
        "nuvem",
      ].includes(r.zona)
    )
      fail("Tipo ou zona de ativo fora do contrato.");
    for (const field of [
      "exposto_internet",
      "mfa",
      "atualizado",
      "backup_testado",
    ])
      if (!["sim", "nao", "desconhecido"].includes(r[field]))
        fail("Use sim, nao ou desconhecido nos estados do inventário.");
    if (r.ip) r.ip = ipAddress(r.ip).canonical;
    const ports = r.portas ? r.portas.split(",").map((p) => p.trim()) : [];
    if (
      ports.some(
        (p) => !/^\d{1,5}$/.test(p) || Number(p) < 1 || Number(p) > 65535,
      )
    )
      fail("Portas devem ser números de 1 a 65535 separados por vírgula.");
    r.portas = [...new Set(ports.map(Number))].sort((a, b) => a - b).join(",");
    return r;
  });
}
export function assetFindings(assets) {
  const findings = [];
  for (const asset of assets) {
    const push = (priority, title, action) =>
      findings.push({
        id: asset.id,
        nome: asset.nome,
        priority,
        title,
        action,
      });
    const exposed = asset.exposto_internet === "sim",
      ports = asset.portas.split(",").map(Number);
    if (exposed && ports.some((p) => [21, 23, 445, 3389].includes(p)))
      push(
        "Urgente",
        "Serviço sensível declarado na internet",
        "Confirmar a exposição com a equipe; planejar acesso restrito e validar a continuidade do serviço.",
      );
    if (
      exposed &&
      ["servidor", "nuvem", "email", "roteador"].includes(asset.tipo) &&
      asset.mfa === "nao"
    )
      push(
        "Alta",
        "Acesso crítico sem MFA declarado",
        "Conferir suporte a MFA, testar recuperação e habilitar com responsáveis definidos.",
      );
    if (asset.atualizado === "nao")
      push(
        "Alta",
        "Atualização pendente",
        "Identificar a versão, revisar correções e combinar uma janela de atualização.",
      );
    if (
      ["servidor", "computador", "nuvem"].includes(asset.tipo) &&
      asset.backup_testado === "nao"
    )
      push(
        "Alta",
        "Restauração ainda não testada",
        "Executar uma restauração em ambiente isolado e registrar o resultado.",
      );
    for (const field of [
      "exposto_internet",
      "mfa",
      "atualizado",
      "backup_testado",
    ])
      if (asset[field] === "desconhecido")
        push(
          "Confirmar",
          `Estado desconhecido: ${field.replaceAll("_", " ")}`,
          "Consultar o responsável e registrar evidência; desconhecido não equivale a seguro.",
        );
  }
  return findings;
}
export function restoreAssessment(source, controls) {
  const snapshot = strictJSON(source);
  if (
    !exactKeys(snapshot, [
      "schema_version",
      "cenario",
      "answers",
      "notes",
      "assets",
    ]) ||
    snapshot.schema_version !== 1 ||
    !text(snapshot.cenario, 100) ||
    !snapshot.cenario
  )
    fail("Formato de avaliação inválido.");
  if (
    !snapshot.answers ||
    Array.isArray(snapshot.answers) ||
    typeof snapshot.answers !== "object" ||
    !snapshot.notes ||
    Array.isArray(snapshot.notes) ||
    typeof snapshot.notes !== "object"
  )
    fail("Respostas e notas inválidas.");
  assessment(controls, snapshot.answers, snapshot.notes);
  snapshot.assets = normalizeAssets(snapshot.assets);
  return snapshot;
}
export function subnet(cidr) {
  if (typeof cidr !== "string") fail("Informe uma rede CIDR.");
  const parts = cidr.trim().split("/");
  if (parts.length !== 2 || !/^\d{1,3}$/.test(parts[1]))
    fail("Use endereço/prefixo, como 192.0.2.0/24.");
  const ip = ipAddress(parts[0]),
    prefix = Number(parts[1]);
  if (prefix > ip.bits) fail("Prefixo fora do limite.");
  const size = 1n << BigInt(ip.bits - prefix),
    network = (ip.value / size) * size,
    last = network + size - 1n;
  const usable = ip.version === 4 && prefix < 31 ? size - 2n : size;
  const firstHost = ip.version === 4 && prefix < 31 ? network + 1n : network;
  const lastHost = ip.version === 4 && prefix < 31 ? last - 1n : last;
  return {
    version: ip.version,
    prefix,
    network,
    last,
    cidr: `${formatIP(network, ip.version)}/${prefix}`,
    size,
    usable,
    first: formatIP(firstHost, ip.version),
    lastHost: formatIP(lastHost, ip.version),
    broadcast: ip.version === 4 ? formatIP(last, 4) : null,
    normalized: ip.value !== network,
  };
}
export function overlaps(cidrs) {
  if (cidrs.length > 20) fail("Compare até 20 redes por vez.");
  const networks = cidrs.map(subnet),
    result = [];
  for (let i = 0; i < networks.length; i++)
    for (let j = i + 1; j < networks.length; j++) {
      const a = networks[i],
        b = networks[j];
      if (a.version === b.version && a.network <= b.last && b.network <= a.last)
        result.push([a.cidr, b.cidr]);
    }
  return result;
}
export function policy(source, destination, port) {
  const zones = [
    "administracao",
    "interna",
    "servidores",
    "visitantes",
    "iot",
    "internet",
  ];
  if (
    !zones.includes(source) ||
    !zones.includes(destination) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    fail("Zona ou porta inválida.");
  const allowed =
    (source === "administracao" &&
      destination === "servidores" &&
      [22, 443].includes(port)) ||
    (source === "interna" && destination === "servidores" && port === 443) ||
    (["administracao", "interna", "visitantes"].includes(source) &&
      destination === "internet" &&
      port === 443);
  return {
    allowed,
    reason: allowed
      ? "Existe uma permissão explícita na política didática."
      : "Nenhuma regra permite esse caminho; aplica-se a negação por padrão.",
  };
}
