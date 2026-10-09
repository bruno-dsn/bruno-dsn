import { strictJSON, escapeHTML as e } from "./core.js";

const fail = (message) => { throw new Error(message); };
const exact = (value, keys) => value && typeof value === "object" &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

export function newWifiReview(catalog) {
  return {
    schema_version: 1,
    kind: "netguard-wifi-review",
    network_name: "Minha rede",
    answers: Object.fromEntries(catalog.controls.map((c) => [c.id, "unknown"])),
    notes: Object.fromEntries(catalog.controls.map((c) => [c.id, ""])),
  };
}

export function validateWifiReview(value, catalog) {
  const ids = catalog.controls.map((c) => c.id);
  if (!exact(value, ["schema_version", "kind", "network_name", "answers", "notes"]) ||
      value.schema_version !== 1 || value.kind !== "netguard-wifi-review" ||
      typeof value.network_name !== "string" || !value.network_name.trim() ||
      value.network_name.length > 100 || !exact(value.answers, ids) || !exact(value.notes, ids))
    fail("Use uma revisão Wi-Fi exportada pelo NetGuard, esquema 1.");
  for (const id of ids) {
    const answer = value.answers[id], note = value.notes[id];
    if (!Object.hasOwn(catalog.statuses, answer) || typeof answer !== "string" ||
        typeof note !== "string" || note.length > 1000)
      fail("Respostas inválidas ou notas acima de 1.000 caracteres.");
    if (["checked", "na"].includes(answer) && !note.trim())
      fail("Conferido por mim e Não se aplica exigem evidência ou justificativa.");
  }
  return value;
}

export function restoreWifiReview(source, catalog) {
  return validateWifiReview(strictJSON(source), catalog);
}

export function wifiSummary(value, catalog) {
  validateWifiReview(value, catalog);
  const counts = { unknown: 0, review: 0, checked: 0, na: 0 };
  const tasks = [];
  for (const control of catalog.controls) {
    const status = value.answers[control.id];
    counts[status]++;
    if (status === "unknown" || status === "review")
      tasks.push({ ...control, status, action: status === "unknown" ? control.verify : control.next });
  }
  return { counts, tasks };
}

export function wifiHTML(value, catalog) {
  const { counts } = wifiSummary(value, catalog);
  const articles = catalog.controls.map((control) => {
    const status = value.answers[control.id];
    return `<article><h2>${e(control.title)}</h2><p>Declaração: ${e(catalog.statuses[status])}</p><p class="note">Evidência ou justificativa: ${e(value.notes[control.id] || "Não registrada.")}</p><p>Como conferir: ${e(control.verify)}</p><p>Próxima ação: ${e(status === "unknown" ? control.verify : status === "review" ? control.next : "Revisar a evidência periodicamente e após mudanças.")}</p></article>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>NetGuard Lab · Revisão Wi-Fi</title><style>body{font:16px/1.6 system-ui;color:#1b231d;max-width:900px;margin:40px auto;padding:0 24px}h1,h2{color:#2f6b3f}article{border:1px solid #d1c09f;padding:18px;margin:14px 0;break-inside:avoid}.note{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>NetGuard Lab · ${e(value.network_name)}</h1><p>Revisão declarada de Wi-Fi e roteador. O aplicativo não conectou equipamentos nem verificou as respostas. Não é uma nota de segurança.</p><p>${counts.unknown} a confirmar · ${counts.review} com ajuste declarado · ${counts.checked} conferidos pelo usuário · ${counts.na} não aplicáveis.</p><p>Revise impacto, permissões e responsáveis antes de mudar configurações. Este arquivo pode conter anotações internas; revise antes de compartilhar.</p>${articles}</html>`;
}
