import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FIELDS,
  NOTE_FIELDS,
  parseCSV,
  parseEvents,
  investigate,
  strictJSON,
  makeNotebook,
  restoreNotebook,
  investigationHTML,
  safeCSV,
  assessment,
  restoreAssessment,
  inventory,
  assetFindings,
  ipAddress,
  subnet,
  overlaps,
  policy,
  money,
} from "../core.js";

const financial = new Uint8Array(
  await readFile(
    new URL("../data/caso-financeiro-ficticio.csv", import.meta.url),
  ),
);
const benign = new Uint8Array(
  await readFile(new URL("../data/caso-benigno-ficticio.csv", import.meta.url)),
);
const catalog = JSON.parse(
  await readFile(new URL("../data/controls.json", import.meta.url), "utf8"),
);
const shop = await readFile(
  new URL("../data/cenario-loja.json", import.meta.url),
  "utf8",
);
const encode = (rows) =>
  new TextEncoder().encode(
    [
      FIELDS.join(","),
      ...rows.map((r) =>
        FIELDS.map((f) => '"' + r[f].replaceAll('"', '""') + '"').join(","),
      ),
    ].join("\n"),
  );
const rawRows = parseCSV(new TextDecoder().decode(financial)).rows;

test("financial fixture keeps exact evidence, source hash and integer-centavo totals", async () => {
  const parsed = await parseEvents(financial),
    result = investigate(parsed, 15000, true);
  assert.equal(result.events.length, 13);
  assert.equal(result.signals.length, 7);
  assert.equal(result.transfer_total_centavos, 6000000n);
  assert.equal(result.transfer_count, 2);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.bytes, financial.length);
  assert.ok(
    result.signals.every((s) =>
      s.event_ids.every((id) => result.events.some((ev) => ev.event_id === id)),
    ),
  );
  assert.ok(result.signals.every((s) => !s.event_ids.includes("E009")));
  assert.deepEqual(
    result.signals.find((s) => s.sinal.startsWith("Origem")).event_ids,
    ["E001", "E007"],
  );
  assert.equal(money(result.transfer_total_centavos), "R$ 60.000,00");
});
test("cross-source correlation requires explicit confirmation", async () => {
  const r = investigate(await parseEvents(financial));
  assert.equal(r.signals.length, 5);
  assert.ok(
    !r.signals.some((s) => s.sinal.startsWith("Alteração e transferência")),
  );
});
test("benign case demonstrates a false positive", async () => {
  const r = investigate(await parseEvents(benign), 15000, true);
  assert.equal(r.signals.length, 1);
  assert.equal(r.transfer_total_centavos, 80000n);
  assert.match(r.signals[0].explicacao_alternativa, /esquecido/);
});
test("JSONL and CSV agree on normalized events, signals and amount", async () => {
  const jsonl = new Uint8Array(
    await readFile(
      new URL("../data/caso-financeiro-ficticio.jsonl", import.meta.url),
    ),
  );
  const a = investigate(await parseEvents(financial), 15000, true),
    b = investigate(await parseEvents(jsonl, "jsonl"), 15000, true);
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.signals, b.signals);
  assert.notEqual(a.sha256, b.sha256);
});
for (const [field, value] of [
  ["usuario", "outro"],
  ["sessao", "outra"],
  ["timestamp", "2026-10-08T13:20:00Z"],
])
  test(`correlation respects ${field}`, async () => {
    const rows = rawRows.map((r) => ({ ...r }));
    rows.find((r) => r.event_id === "E011")[field] = value;
    const r = investigate(await parseEvents(encode(rows)), 15000, true);
    assert.ok(
      r.signals
        .filter((s) => s.sinal.startsWith("Alteração e transferência"))
        .every((s) => !s.event_ids.includes("E011")),
    );
  });
test("unknown transfer amount is excluded and disclosed", async () => {
  const rows = rawRows.map((r) => ({ ...r }));
  rows.find((r) => r.event_id === "E011").valor_brl = "";
  const r = investigate(await parseEvents(encode(rows)));
  assert.equal(r.transfers_without_amount, 1);
  assert.equal(r.transfer_total_centavos, 3200000n);
});
for (const amount of [
  "NaN",
  "Infinity",
  "-1",
  "1.009",
  "1000000000001",
  "1e3",
  "+20",
])
  test(`reject unsafe amount ${amount}`, async () => {
    const rows = rawRows.map((r) => ({ ...r }));
    rows[0].valor_brl = amount;
    await assert.rejects(() => parseEvents(encode(rows)));
  });
test("timestamps are validated and sorted by instant including microseconds", async () => {
  const rows = rawRows.slice(0, 2).map((r) => ({ ...r }));
  rows[0].timestamp = "2026-10-08T09:00:00.000002-03:00";
  rows[1].timestamp = "2026-10-08T12:00:00.000001Z";
  const p = await parseEvents(encode(rows));
  assert.deepEqual(
    p.events.map((e) => e.event_id),
    ["E002", "E001"],
  );
  assert.equal(p.events[1].timestamp, "2026-10-08T12:00:00.000002+00:00");
});
for (const timestamp of [
  "2026-10-08T12:00:00",
  "2026-02-30T12:00:00Z",
  "2026-10-08T24:00:00Z",
  "2026-10-08T12:00:00+24:00",
])
  test(`reject invalid time ${timestamp}`, async () => {
    await assert.rejects(() =>
      parseEvents(encode([{ ...rawRows[0], timestamp }])),
    );
  });
test("CSV preserves multiline and escaped strings; rejects quotes and column mismatch", () => {
  assert.deepEqual(parseCSV('a,b\r\n"primeira\nsegunda","a""b"\r\n').rows, [
    { a: "primeira\nsegunda", b: 'a"b' },
  ]);
  for (const csv of ["a,a\n1,2", "a,b\n1", 'a,b\n"ab', 'a,b\n"a"x,b'])
    assert.throws(() => parseCSV(csv));
});
test("UTF-8, row/field limits, duplicate IDs and JSONL keys are enforced", async () => {
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array([255]),
    new Uint8Array(2097153),
    encode([rawRows[0], rawRows[0]]),
    encode([{ ...rawRows[0], recurso: "x".repeat(201) }]),
  ])
    await assert.rejects(() => parseEvents(bytes));
  await assert.rejects(() =>
    parseEvents(
      new TextEncoder().encode('{"event_id":"a","event_id":"b"}\n'),
      "jsonl",
    ),
  );
  assert.throws(() => parseCSV("a\n" + Array(10001).fill("x").join("\n")));
});
test("strict JSON rejects duplicate keys, deep payloads and prototype confusion", () => {
  assert.throws(() => strictJSON('{"notas":{"a":1,"a":2}}'));
  assert.throws(() => strictJSON("[".repeat(22) + "0" + "]".repeat(22)));
  assert.throws(() => strictJSON('{"a":1e999}'));
  assert.throws(() => strictJSON("{} extra"));
  const r = strictJSON('{"__proto__":{"polluted":true}}');
  assert.equal(Object.getPrototypeOf(r), null);
  assert.equal({}.polluted, undefined);
});
test("notebook restoration rejects wrong bytes, IDs, version and oversized notes", async () => {
  const r = investigate(await parseEvents(financial), 15000, true),
    notes = Object.fromEntries(NOTE_FIELDS.map((f) => [f, ""]));
  notes.observacoes = "E008 informa mudança.";
  const n = makeNotebook(r, notes, "Caso fictício");
  assert.deepEqual({ ...restoreNotebook(JSON.stringify(n), r).notas }, notes);
  for (const patch of [
    { schema_version: true },
    { bytes: true },
    { arquivo_sha256: "0".repeat(64) },
    { ids_eventos: ["outro"] },
    { limiar_transferencia_brl: true },
    { ids_sessao_compativeis: 1 },
    { notas: { ...notes, observacoes: "x".repeat(3001) } },
    { extra: "x" },
  ])
    assert.throws(() => restoreNotebook(JSON.stringify({ ...n, ...patch }), r));
});
test("exports neutralize HTML and spreadsheet formulas", async () => {
  const r = investigate(await parseEvents(financial)),
    notes = Object.fromEntries(
      NOTE_FIELDS.map((f) => [f, "<img src=x onerror=alert(1)>"]),
    );
  const html = investigationHTML(r, notes, "<script>caso</script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  const csv = safeCSV(
    [{ a: "  =SUM(1,2)", b: "@cmd", c: "normal" }],
    ["a", "b", "c"],
  );
  assert.ok(csv.includes("'  =SUM"));
  assert.ok(csv.includes("'@cmd"));
});
test("large totals stay exact above Number.MAX_SAFE_INTEGER and signal cards stay bounded", async () => {
  const row = { ...rawRows[10], valor_brl: "1000000000000" };
  const rows = Array.from({ length: 1100 }, (_, i) => ({
    ...row,
    event_id: `E${String(i).padStart(5, "0")}`,
  }));
  const r = investigate(await parseEvents(encode(rows)));
  assert.equal(r.transfer_total_centavos, 110000000000000000n);
  assert.equal(r.signal_count, 1100);
  assert.equal(r.signals_omitted, 100);
  assert.equal(r.signals.length, 1000);
  const changes = Array.from({ length: 60 }, (_, i) => ({
    ...rawRows[9],
    event_id: `A${i}`,
  }));
  const related = investigate(
    await parseEvents(encode([...changes, rawRows[10]])),
    15000,
    true,
  ).signals.at(-1);
  assert.equal(related.event_ids.length, 50);
  assert.equal(related.evidencias_omitidas, 11);
});
test("assessment restore, unknown answers, N/A justification and all-N/A score", () => {
  const snapshot = restoreAssessment(shop, catalog.controls),
    s = assessment(catalog.controls, snapshot.answers, snapshot.notes);
  assert.equal(s.score, 35.1);
  assert.equal(s.unknown, 2);
  const answers = Object.fromEntries(catalog.controls.map((c) => [c.id, "na"])),
    notes = Object.fromEntries(
      catalog.controls.map((c) => [c.id, "Contexto fictício justificado."]),
    );
  assert.equal(assessment(catalog.controls, answers, notes).score, null);
  assert.throws(() => assessment(catalog.controls, answers));
  assert.throws(() => assessment(catalog.controls, { unknown: "implemented" }));
});
test("inventory flags declared sensitive exposure, not HTTPS alone", async () => {
  const rows = inventory(
    new Uint8Array(
      await readFile(
        new URL("../data/inventario-exemplo.csv", import.meta.url),
      ),
    ),
  );
  assert.ok(assetFindings(rows).some((f) => f.priority === "Urgente"));
  const asset = { ...rows[0], exposto_internet: "sim", portas: "443" };
  assert.ok(!assetFindings([asset]).some((f) => f.priority === "Urgente"));
});
test("IPv4, IPv6 and CIDR boundaries are exact", () => {
  assert.equal(ipAddress("2001:0db8:0:0:0:0:0:1").canonical, "2001:db8::1");
  assert.equal(ipAddress("::ffff:192.0.2.1").canonical, "::ffff:c000:201");
  for (const ip of [
    "192.168.01.1",
    "256.0.0.1",
    "1::2::3",
    "1:2:3",
    "fe80::1%eth0",
  ])
    assert.throws(() => ipAddress(ip));
  assert.equal(subnet("192.0.2.48/24").cidr, "192.0.2.0/24");
  assert.equal(subnet("192.0.2.0/31").usable, 2n);
  assert.equal(subnet("192.0.2.1/32").usable, 1n);
  assert.equal(subnet("2001:db8::/64").size, 18446744073709551616n);
  assert.equal(subnet("::/0").size, 1n << 128n);
  assert.equal(subnet("2001:db8::/128").usable, 1n);
  assert.deepEqual(
    overlaps(["192.0.2.0/24", "192.0.2.128/25", "2001:db8::/32"]),
    [["192.0.2.0/24", "192.0.2.128/25"]],
  );
});
test("TCP policy denies by default and validates invalid ports", () => {
  assert.equal(policy("visitantes", "servidores", 3389).allowed, false);
  assert.equal(policy("administracao", "servidores", 22).allowed, true);
  assert.equal(policy("visitantes", "internet", 443).allowed, true);
  assert.throws(() => policy("visitantes", "internet", 443.5));
});
