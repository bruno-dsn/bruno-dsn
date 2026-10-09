import {
  FIELDS,
  NOTE_FIELDS,
  FIELD_GUIDE,
  MAX_BYTES,
  parseEvents,
  investigate,
  money,
  escapeHTML as e,
  safeCSV,
  makeNotebook,
  restoreNotebook,
  investigationHTML,
  assessment,
  inventory,
  normalizeAssets,
  assetFindings,
  restoreAssessment,
  subnet,
  overlaps,
  policy,
} from "./core.js";

const ROUTES = [
  "inicio",
  "aprender",
  "investigar",
  "diagnostico",
  "inventario",
  "redes",
  "plano",
];
const LABELS = {
  inicio: "Início",
  aprender: "Ler um log",
  investigar: "Investigar logs",
  diagnostico: "Proteção inicial",
  inventario: "Inventário",
  redes: "Laboratório de redes",
  plano: "Meu plano",
};
const NOTE_LABELS = [
  "Observações e IDs dos eventos",
  "Hipóteses e explicações alternativas",
  "Perguntas e evidências pendentes",
  "Contenção proposta, responsável e validação",
];
const CASES = {
  financeiro: {
    name: "Fraude financeira fictícia",
    file: "caso-financeiro-ficticio.csv",
  },
  benigno: { name: "Caso benigno fictício", file: "caso-benigno-ficticio.csv" },
};
const h = (
  title,
  description,
  eyebrow = "CIBERSEGURANÇA, NA PRÁTICA",
  badge = "",
) =>
  `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${badge ? `<span class="badge">${badge}</span>` : ""}</div>`;
const notice = (content, type = "") =>
  `<div class="notice ${type}">${content}</div>`;
const stat = (label, value) =>
  `<div class="stat"><small>${label}</small><strong>${e(value)}</strong></div>`;
const outcome = (value) =>
  `<span class="pill ${value === "falha" || value === "negado" ? "bad" : value === "sucesso" ? "good" : ""}">${e(value)}</span>`;
const option = (value, label, current) =>
  `<option value="${e(value)}"${value === current ? " selected" : ""}>${e(label)}</option>`;
const timeLabel = (timestamp) => timestamp.slice(11, 19);
const EMPTY_NOTES = () => Object.fromEntries(NOTE_FIELDS.map((k) => [k, ""]));

/** Injecte fetch/document para verificar os fluxos sem depender de um servidor. */
export async function createApp(doc, dependencies = {}) {
  const win = doc.defaultView,
    fetcher = dependencies.fetch ?? globalThis.fetch.bind(globalThis),
    main = doc.getElementById("main");
  const request = async (path) => {
    const response = await fetcher(path);
    if (!response.ok)
      throw new Error(
        "Não foi possível carregar os exemplos. Recarregue a página.",
      );
    return response;
  };
  const [catalog, shop, office, financial, benign] = await Promise.all([
    request("data/controls.json").then((r) => r.json()),
    request("data/cenario-loja.json").then((r) => r.text()),
    request("data/cenario-escritorio.json").then((r) => r.text()),
    request("data/caso-financeiro-ficticio.csv").then((r) => r.arrayBuffer()),
    request("data/caso-benigno-ficticio.csv").then((r) => r.arrayBuffer()),
  ]);
  const controls = catalog.controls,
    statuses = catalog.statuses,
    snapshots = { loja: shop, escritorio: office };
  const examples = {
    financeiro: await parseEvents(new Uint8Array(financial)),
    benigno: await parseEvents(new Uint8Array(benign)),
  };
  const state = {
    route: ROUTES.includes(win.location.hash.slice(1))
      ? win.location.hash.slice(1)
      : "inicio",
    case: "financeiro",
    caseName: CASES.financeiro.name,
    parsed: examples.financeiro,
    threshold: 15000,
    shared: true,
    tab: "timeline",
    selected: 6,
    selectedField: "usuario",
    search: "",
    source: "todas",
    outcome: "todos",
    page: 0,
    signalPage: 0,
    notebooks: new Map(),
    snapshot: restoreAssessment(shop, controls),
    area: "Todas",
    scenario: "loja",
    network: {
      cidr: "192.0.2.48/24",
      source: "visitantes",
      destination: "servidores",
      port: 3389,
      compare: "192.0.2.0/24\n192.0.2.128/25\n198.51.100.0/24",
    },
    fileOpened: false,
    flipped: false,
    learnStep: 0,
    busy: false,
    sequence: 0,
    reduced: !!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  };
  let result = investigate(state.parsed, state.threshold, state.shared),
    toastTimer;
  function notify(message, error = false) {
    const toast = doc.getElementById("toast");
    toast.textContent = message;
    toast.setAttribute("role", error ? "alert" : "status");
    toast.hidden = false;
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(
      () => {
        toast.hidden = true;
      },
      error ? 9000 : 5500,
    );
  }
  function notes() {
    if (!state.notebooks.has(result.sha256))
      state.notebooks.set(result.sha256, EMPTY_NOTES());
    return state.notebooks.get(result.sha256);
  }
  function recalculate() {
    result = investigate(state.parsed, state.threshold, state.shared);
    state.selected = Math.min(state.selected, result.events.length - 1);
  }
  function download(content, name, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob),
      anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = name;
    doc.body.append(anchor);
    anchor.click();
    anchor.remove();
    win.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Arquivo exportado. Revise os dados antes de compartilhar.");
  }
  function currentEvent() {
    return result.events[state.selected] ?? result.events[0];
  }
  function eventDetail(event, learning = false) {
    const selected = state.selectedField,
      [question, explanation] = FIELD_GUIDE[selected];
    const sentence = `Em ${event.timestamp.slice(0, 10)}, às ${timeLabel(event.timestamp)} UTC, a fonte ${event.origem} registrou ${event.acao.replaceAll("_", " ")} para ${event.usuario || "uma conta não informada"}${event.ip ? " a partir de " + event.ip : " sem IP informado"}. O resultado registrado foi ${event.resultado}.`;
    return `<section class="panel event-detail"><div class="detail-top"><span class="eyebrow">REGISTRO ${e(event.event_id)}</span>${outcome(event.resultado)}</div><h2>${learning ? "Um log, em linguagem simples." : e(event.acao.replaceAll("_", " "))}</h2><p class="event-sentence">${e(sentence)}</p><p class="small-text muted">${learning ? "Toque nos campos para entender o que cada um conta — e o que ainda precisa ser confirmado." : "O registro descreve o que a fonte informou. Clique em um campo para ver sua explicação."}</p><div class="field-chips">${FIELDS.map((f) => `<button class="field-chip" data-action="field" data-value="${f}" aria-pressed="${selected === f}">${f}</button>`).join("")}</div><div class="field-explainer" aria-live="polite"><h3>${e(question)}</h3><span class="value">${e(event[selected] || "Não informado no arquivo")}</span><p>${e(explanation)}</p></div><div class="event-table-wrap"><table><caption>Todos os campos deste registro</caption><tbody>${FIELDS.map((f) => `<tr><th scope="row">${f}</th><td class="mono">${e(event[f] || "Não informado")}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  function home() {
    return `<section class="hero"><div><span class="eyebrow">REDES + CIBERSEGURANÇA · PARA COMEÇAR</span><h1>Segurança começa com um <em>primeiro passo.</em></h1><p class="lead">Entenda um log, investigue um caso e organize o que sua empresa precisa proteger. Sem precisar saber tudo antes de começar.</p><div class="button-row"><a class="button" href="#aprender">Nunca li um log <span aria-hidden="true">↗</span></a><a class="button secondary" href="#investigar">Explorar um caso <span aria-hidden="true">→</span></a></div><p class="hero-note">SEM INSTALAÇÃO · EXEMPLOS FICTÍCIOS · NO SEU RITMO</p></div><div class="case-stage"><span class="orbit-mark" aria-hidden="true">✳</span><span class="sticker">Abra. Observe. Questione.</span><div class="ticket${state.flipped ? " turn" : ""}"><div class="ticket-top"><span class="mono">DOSSIÊ / 001</span><span class="ticket-stamp">CASO<br>FICTÍCIO</span></div><div class="ticket-body">${state.flipped ? '<span class="eyebrow">O QUE AINDA NÃO SABEMOS</span><h2>Um sinal é o início da pergunta.</h2><p class="small-text">A transferência tinha aprovação? O MFA foi removido pelo suporte? O IP era de uma VPN?</p><p class="small-text"><strong>Investigar é comparar explicações com evidências.</strong></p>' : '<span class="eyebrow">LOJA AURORA · CENÁRIO DE ESTUDO</span><h2>O que aconteceu<br>com essa conta?</h2><div class="mini-log"><time>12:06</time><span><i class="mini-dot"></i><strong>Login após cinco falhas</strong><span class="muted">Conta financeiro.demo</span></span></div><div class="mini-log"><time>12:07</time><span><i class="mini-dot"></i><strong>MFA desativado</strong><span class="muted">Mudança na proteção da conta</span></span></div><div class="mini-log"><time>12:20</time><span><i class="mini-dot"></i><strong>Transferência registrada</strong><span class="muted">O que precisamos confirmar?</span></span></div>'}</div><div class="ticket-footer"><span>13 EVENTOS · HORÁRIOS UTC</span><button class="ticket-flip" data-action="flip" aria-pressed="${state.flipped}">${state.flipped ? "Ver registros ↶" : "Virar cartão ↻"}</button></div><span class="serial" aria-hidden="true">NG / EXERCÍCIO 001 / 2026</span></div></div></section><section class="intro-band" aria-label="Como funciona"><div><span class="number-label">01</span><strong>Aprenda a observar.</strong><p>Leia cada campo e entenda seus limites.</p></div><div><span class="number-label">02</span><strong>Conecte as evidências.</strong><p>Monte a sequência e compare hipóteses.</p></div><div><span class="number-label">03</span><strong>Planeje a proteção.</strong><p>Transforme dúvidas em ações verificáveis.</p></div></section><section class="section"><div class="section-heading"><h2>Seu laboratório.<br><span class="highlight">Um caminho de cada vez.</span></h2><p>Escolha onde começar. Você pode voltar, experimentar e mudar as respostas enquanto aprende.</p></div><div class="grid cols-3"><article class="paper-card lift"><div class="card-icon" aria-hidden="true">⌕</div><h3>Aprenda a ler um log.</h3><p>Quem? Quando? Qual ação? Um registro explicado, campo por campo, com exemplos que fazem sentido.</p><a class="text-link" href="#aprender">Abrir o guia interativo →</a></article><article class="paper-card lift"><div class="card-icon" aria-hidden="true">↳</div><h3>Investigue com contexto.</h3><p>Percorra a linha do tempo, filtre eventos e registre suas hipóteses. Compare também um caso benigno.</p><a class="text-link" href="#investigar">Entrar na investigação →</a></article><article class="paper-card lift"><div class="card-icon" aria-hidden="true">✓</div><h3>Comece a proteger.</h3><p>Revise 18 controles, identifique ativos e monte um plano. Cada recomendação explica sua próxima ação.</p><a class="text-link" href="#diagnostico">Fazer o diagnóstico →</a></article></div></section><section class="journey"><div><span class="eyebrow">UM EXERCÍCIO COMPLETO</span><h2>Do registro à próxima verificação.</h2><p>A loja fictícia relata duas transferências não reconhecidas. Você acompanha o recorte e constrói um caderno que outra pessoa consegue revisar.</p><a class="button yellow" href="#investigar">Investigar a Loja Aurora ↗</a></div><ol><li><strong>Conheça o relato.</strong><br>Separe o que foi informado do que foi confirmado.</li><li><strong>Observe a sequência.</strong><br>Login, identidade e financeiro lado a lado.</li><li><strong>Teste uma explicação alternativa.</strong><br>Comportamento suspeito também pode ser legítimo.</li><li><strong>Proponha uma verificação.</strong><br>Preserve o recorte e documente o que falta.</li></ol></section><section class="section"><div class="section-heading"><h2>Pode começar com dúvidas.</h2><p>O laboratório foi feito para ajudar você a fazer perguntas melhores.</p></div><div class="faq"><details><summary>Preciso saber redes ou programação?</summary><p>Você pode começar pelo guia “Ler um log”. Ele explica os campos sem exigir configuração de servidor. O laboratório de redes também mostra o motivo de cada permissão ou bloqueio.</p></details><details><summary>Os logs que eu abrir vão para um servidor?</summary><p>Esta edição lê os arquivos na memória do navegador. Não existe coletor, envio de logs ou armazenamento de notas no servidor. Fechar ou recarregar a página pode encerrar seu trabalho; exporte o caderno para continuar depois.</p></details><details><summary>Um sinal confirma uma invasão?</summary><p>Um sinal destaca uma sequência para verificar. Ele não confirma invasão, autoria, origem do ataque ou prejuízo. O caso benigno mostra como alguém que esqueceu a senha também pode gerar um sinal.</p></details><details><summary>Posso usar para estudar ou mostrar no portfólio?</summary><p>Sim. O código e a versão Python estão no GitHub. Use os casos fictícios para demonstrar o raciocínio. Para trabalhar com logs reais, obtenha autorização, reduza dados sensíveis e confira o contrato de importação.</p></details></div></section>`;
  }
  function learning() {
    const steps = [
      {
        title: "Comece pelo que está escrito.",
        body: "Um log é um registro produzido por um sistema. Ele informa uma ação e o contexto que a fonte conseguiu registrar. Primeiro descreva o evento; depois pense nas hipóteses.",
        ids: ["E007"],
        tip: "“A fonte registrou um login com sucesso.” Essa frase é mais precisa do que “a pessoa invadiu a conta”.",
      },
      {
        title: "Leia a sequência, não só uma linha.",
        body: "As cinco falhas anteriores e o login merecem uma pergunta. Um erro de senha, um cliente mal configurado e um uso indevido são explicações diferentes.",
        ids: ["E002", "E003", "E004", "E005", "E006", "E007"],
        tip: "Confirme se o acesso era esperado por um canal conhecido e procure o histórico original.",
      },
      {
        title: "Não misture conta com pessoa.",
        body: "O campo usuario mostra a conta informada pela fonte. O IP é um endereço de rede. VPNs, proxies e redes compartilhadas limitam o que esses campos conseguem dizer.",
        ids: ["E001", "E007"],
        tip: "Compare dispositivo, MFA e contexto. Um IP diferente neste recorte não confirma um invasor.",
      },
      {
        title: "Registre o que falta confirmar.",
        body: "A alteração de MFA e a transferência levantam perguntas. Correlacionar exige confirmar como cada sistema define as sessões e conferir as aprovações.",
        ids: ["E008", "E010", "E011"],
        tip: "Anote o ID, a hipótese, uma alternativa e a próxima verificação. Um bom caderno permite revisar seu raciocínio.",
      },
    ];
    const step = steps[state.learnStep],
      event = examples.financeiro.events.find(
        (x) => x.event_id === step.ids.at(-1),
      );
    return (
      h(
        "Leia um log sem se perder.",
        "Um registro de cada vez. Toque nos campos, acompanhe o exemplo e veja o que ainda precisa ser verificado.",
        "GUIA INTERATIVO · PRIMEIRO CONTATO",
        "CASO FICTÍCIO",
      ) +
      `<div class="learn-layout"><div><section class="panel"><span class="eyebrow">PASSO ${state.learnStep + 1} DE ${steps.length}</span><h2>${step.title}</h2><p>${step.body}</p>${notice(step.tip)}<p class="mono">EVENTOS DO EXEMPLO: ${step.ids.join(" · ")}</p><div class="exercise-nav"><button class="secondary small" data-action="learn-prev"${state.learnStep === 0 ? " disabled" : ""}>← Anterior</button>${state.learnStep < steps.length - 1 ? '<button class="small" data-action="learn-next">Próximo passo →</button>' : '<a class="button small" href="#investigar">Abrir investigação ↗</a>'}</div></section><section class="panel green-panel section"><span class="eyebrow">UM HÁBITO QUE AJUDA</span><h3>Descreva antes de concluir.</h3><p class="muted">“O evento E008 informa que o MFA foi desativado.”<br><br>Agora a pergunta: havia uma recuperação de conta autorizada?</p></section></div>${eventDetail(event, true)}</div><section class="section"><div class="section-heading"><h2>Registro, sinal, incidente.</h2><p>São etapas diferentes do raciocínio. Você ganha clareza ao dizer em qual delas está.</p></div><div class="concept-row"><article class="panel"><span class="number-label">01 / REGISTRO</span><h3>O sistema informou.</h3><p>Uma linha descreve uma ação. Exemplo: a fonte registrou um login com sucesso às 12:06 UTC.</p></article><article class="panel"><span class="number-label">02 / SINAL</span><h3>Vale verificar.</h3><p>Uma regra destaca o login depois de cinco falhas. Há uma pergunta, mas ainda há explicações alternativas.</p></article><article class="panel"><span class="number-label">03 / INCIDENTE</span><h3>Há contexto e confirmação.</h3><p>A equipe revisa evidências e critérios para avaliar o ocorrido. A regra deste laboratório não decide isso sozinha.</p></article></div></section>`
    );
  }
  function caseToolbar() {
    return `<div class="toolbar"><div class="field"><label for="case-select">Qual caso vamos observar?</label><select id="case-select">${option("financeiro", CASES.financeiro.name, state.case)}${option("benigno", CASES.benigno.name, state.case)}${option("arquivo", "Meu arquivo CSV ou JSONL", state.case)}</select><small>${state.case === "arquivo" ? "Seu arquivo precisa seguir o contrato dos exemplos." : "As contas e operações são fictícias."}</small></div>${state.case === "arquivo" ? '<div class="field"><label for="log-file">Abrir eventos · até 2 MB</label><input id="log-file" type="file" accept=".csv,.jsonl" data-upload="logs"><small>UTF-8 · até 10.000 eventos · dez campos</small></div>' : ""}<div class="field compact"><label for="threshold">Limiar por operação (R$)</label><input id="threshold" type="number" min="1" max="1000000000" step="1" value="${state.threshold}"><small>Uma escolha de triagem.</small></div><div class="field"><label class="check-label" for="shared"><input id="shared" type="checkbox"${state.shared ? " checked" : ""}><span>Confirmei que os IDs de sessão são compatíveis entre as fontes</span></label><small>${state.case === "arquivo" ? "Desmarcado ao importar. Confirme se os sistemas identificam a mesma sessão." : "Premissa explícita dos sistemas fictícios deste exercício."}</small></div></div>`;
  }
  function filtered() {
    const query = state.search.toLocaleLowerCase("pt-BR");
    return result.events.filter(
      (ev) =>
        (state.source === "todas" || ev.origem === state.source) &&
        (state.outcome === "todos" || ev.resultado === state.outcome) &&
        (!query ||
          FIELDS.some((f) => ev[f].toLocaleLowerCase("pt-BR").includes(query))),
    );
  }
  function timeline() {
    const events = filtered(),
      pageCount = Math.max(1, Math.ceil(events.length / 30));
    state.page = Math.min(state.page, pageCount - 1);
    return `<div class="timeline-controls"><button class="secondary small" data-action="event-prev"${state.selected === 0 ? " disabled" : ""}>← Anterior</button><div class="range-field"><label for="timeline-slider">Percorra os ${result.events.length} eventos completos · UTC</label><input type="range" id="timeline-slider" min="0" max="${result.events.length - 1}" value="${state.selected}"></div><span class="counter">${state.selected + 1} / ${result.events.length}</span><button class="small" data-action="event-next"${state.selected === result.events.length - 1 ? " disabled" : ""}>Próximo →</button></div><div class="filter-line"><div class="field"><label for="search">Buscar no recorte</label><input id="search" type="search" value="${e(state.search)}" placeholder="Conta, IP, ação ou ID…" maxlength="200"></div><div class="field"><label for="source-filter">Fonte</label><select id="source-filter">${["todas", "autenticacao", "identidade", "financeiro", "rede"].map((v) => option(v, v === "todas" ? "Todas as fontes" : v, state.source)).join("")}</select></div><div class="field"><label for="outcome-filter">Resultado</label><select id="outcome-filter">${["todos", "sucesso", "falha", "negado", "informativo"].map((v) => option(v, v === "todos" ? "Todos os resultados" : v, state.outcome)).join("")}</select></div></div><div class="workspace-grid"><section class="panel"><span class="eyebrow">${events.length} EVENTOS NO FILTRO · UTC</span>${
      events.length
        ? `<div class="event-list" aria-label="Eventos filtrados">${events
            .slice(state.page * 30, (state.page + 1) * 30)
            .map(
              (ev) =>
                `<button class="event-row" data-action="select-event" data-value="${e(ev.event_id)}" aria-pressed="${ev === currentEvent()}"><span class="event-time">${timeLabel(ev.timestamp)}<br>${ev.timestamp.slice(5, 10)}</span><span><strong>${e(ev.acao.replaceAll("_", " "))}</strong><span class="event-meta">${e(ev.event_id)} · ${e(ev.origem)}<br>${e(ev.usuario || "Conta não informada")}</span></span>${outcome(ev.resultado)}</button>`,
            )
            .join(
              "",
            )}</div><div class="pager"><button class="secondary small" data-action="page-prev"${state.page === 0 ? " disabled" : ""}>←</button><span>Página ${state.page + 1} de ${pageCount}</span><button class="secondary small" data-action="page-next"${state.page + 1 === pageCount ? " disabled" : ""}>→</button></div>`
        : '<div class="empty"><p>Nenhum evento corresponde ao filtro.</p><button class="small secondary" data-action="clear-filters">Limpar filtros</button></div>'
    }<div class="button-row section"><button class="secondary small" data-action="export-timeline">Exportar recorte filtrado CSV ↓</button><button class="ghost small" data-action="show-signals">Ver sinais →</button></div></section>${eventDetail(currentEvent())}</div>`;
  }
  function signals() {
    const cards = result.signals.slice(
        state.signalPage * 10,
        (state.signalPage + 1) * 10,
      ),
      pages = Math.max(1, Math.ceil(result.signals.length / 10));
    return `<p class="muted small-text">As regras são explícitas. Cada cartão separa o registro, a hipótese, uma alternativa e a próxima verificação. Clique em um ID para abrir a evidência.</p>${cards.length ? cards.map((s, i) => `<article class="signal-card"><div class="signal-header"><div><span class="eyebrow">SINAL ${String(state.signalPage * 10 + i + 1).padStart(2, "0")}</span><h3>${e(s.sinal)}</h3></div><span class="pill warn">Verificar contexto</span></div><div class="signal-blocks"><div class="signal-block fact"><span class="eyebrow">O QUE ESTÁ REGISTRADO</span><p>${e(s.observacao)}</p></div><div class="signal-block hypothesis"><span class="eyebrow">HIPÓTESE PARA INVESTIGAR</span><p>${e(s.hipotese)}</p></div><div class="signal-block"><span class="eyebrow">EXPLICAÇÃO ALTERNATIVA</span><p>${e(s.explicacao_alternativa)}</p></div><div class="signal-block"><span class="eyebrow">PRÓXIMA VERIFICAÇÃO</span><p>${e(s.proxima_verificacao)}</p></div></div><div class="evidence-buttons" aria-label="Abrir evidências">${s.event_ids.map((id) => `<button data-action="evidence" data-value="${e(id)}">${e(id)} ↗</button>`).join("")}</div>${s.evidencias_omitidas ? notice(`${s.evidencias_omitidas} evidências anteriores foram omitidas deste cartão. Consulte a linha do tempo completa.`, "warning") : ""}</article>`).join("") : '<div class="empty"><p>Nenhum sinal das regras apareceu neste recorte. Isso pode refletir a cobertura limitada das regras ou a falta de registros.</p><a href="#aprender" class="text-link">Rever como ler um log →</a></div>'}${pages > 1 ? `<div class="pager"><button class="secondary small" data-action="signal-prev"${state.signalPage === 0 ? " disabled" : ""}>← Anteriores</button><span>${state.signalPage + 1} de ${pages}</span><button class="secondary small" data-action="signal-next"${state.signalPage + 1 === pages ? " disabled" : ""}>Próximos →</button></div>` : ""}${state.parsed === examples.financeiro ? `<div class="contingency"><span class="card-icon" aria-hidden="true">!</span><div><h3>E a conexão RDP do exemplo?</h3><p>O evento E009 registra uma conexão na porta 3389 no caso financeiro fictício. Isso não estabelece a porta de entrada nem o vínculo com as transferências. Preserve o registro e confira o contexto com a equipe.</p></div></div>` : ""}`;
  }
  function notebook() {
    const n = notes();
    return `<div class="notebook-grid"><section class="panel"><span class="eyebrow">CADERNO DO RECORTE ATUAL</span><h2>Deixe seu raciocínio revisável.</h2><p class="muted">Cite os IDs. Separe fatos de hipóteses. Descreva como pretende confirmar cada ponto.</p><div class="notebook-fields">${NOTE_FIELDS.map((f, i) => `<div class="field"><label for="note-${f}">${NOTE_LABELS[i]}</label><textarea id="note-${f}" data-note="${f}" maxlength="3000" rows="4" placeholder="${["Ex.: E008 informa a desativação de MFA.", "Pode ser alteração indevida ou recuperação autorizada.", "Confirmar aprovação e consultar o histórico original.", "Proposta para a equipe responsável; preservar evidências e validar impacto."][i]}">${e(n[f])}</textarea><div class="note-count" id="count-${f}">${n[f].length} / 3.000</div></div>`).join("")}</div></section><aside><section class="panel"><span class="eyebrow">CONTINUE DEPOIS</span><h3>Exporte seu trabalho.</h3><p>O caderno JSON guarda as notas e os parâmetros. O relatório HTML reúne eventos e sinais para leitura e impressão.</p><div class="button-row"><button class="small" data-action="export-notebook">Caderno JSON ↓</button><button class="small secondary" data-action="export-investigation">Relatório HTML ↓</button></div><div class="field section"><label for="notebook-file">Restaurar caderno do mesmo arquivo</label><input id="notebook-file" type="file" accept=".json" data-upload="notebook"><small>O hash e os IDs precisam corresponder ao recorte aberto. Até 2 MB.</small></div></section><section class="panel section"><span class="eyebrow">IDENTIFICAÇÃO DO RECORTE</span><p class="small-text">${result.bytes.toLocaleString("pt-BR")} bytes · SHA-256</p><div class="hash">${result.sha256}</div><p class="muted small-text">O hash identifica os bytes recebidos. Não comprova origem, autenticidade ou cadeia de custódia.</p><p class="muted small-text">Os arquivos exportados podem conter dados sensíveis. Revise antes de compartilhar.</p></section></aside></div>`;
  }
  function caseIntro() {
    const personal = state.fileOpened;
    return `<div class="grid cols-2"><section class="panel"><span class="eyebrow">${personal ? "ARQUIVO ABERTO" : "EXERCÍCIO FICTÍCIO"}</span><h2>${personal ? "Defina o relato antes de investigar." : state.parsed === examples.benigno ? "Um sinal também pode ser benigno." : "Duas operações não reconhecidas."}</h2><p>${personal ? "Anote de onde veio o arquivo, quem autorizou seu uso e qual período ele cobre. Este laboratório não consegue verificar a procedência dos registros." : state.parsed === examples.benigno ? "A pessoa esqueceu a senha e, depois de entrar, fez uma transferência pequena autorizada. A sequência de falhas ainda gera um sinal. Use esse caso para treinar a comparação de hipóteses." : "A equipe da Loja Aurora relata duas transferências não reconhecidas. O recorte traz falhas de login, um acesso, mudança de MFA e registros financeiros. O relato inicia a investigação; a sequência sozinha não confirma fraude."}</p>${notice(personal ? "Registre suas dúvidas no caderno e confirme os IDs de correlação antes de relacionar sistemas." : "As contas, IPs de documentação, sessões e operações foram criados para estudo. Nenhuma empresa real foi investigada.")}<button class="small" data-action="show-timeline">Percorrer os registros →</button></section><section class="panel"><span class="eyebrow">SEU ROTEIRO</span><ol class="step-list"><li><span class="step-number">1</span><div><strong>Descreva a sequência.</strong>Use a linha do tempo e cite os IDs.</div></li><li><span class="step-number">2</span><div><strong>Compare as hipóteses.</strong>Leia também a explicação alternativa.</div></li><li><span class="step-number">3</span><div><strong>Registre o que falta.</strong>Inclua responsável e próxima verificação.</div></li><li><span class="step-number">4</span><div><strong>Planeje a contenção.</strong>Preserve evidências e valide o impacto com a equipe.</div></li></ol></section></div><section class="panel section"><h3>Como abrir seu próprio recorte</h3><p>Exporte uma cópia autorizada dos registros e adapte as dez colunas abaixo. Este formato representa eventos normalizados, sem tokens ativos ou senhas. Não é um importador universal de todos os produtos de segurança.</p><p class="mono">${FIELDS.join(" · ")}</p><p class="small-text muted">UTF-8; IDs únicos; horário com fuso; valores em reais como 15000.00. Em JSONL, use um objeto por linha e todos os campos como texto. O campo sessao deve conter um identificador de correlação seguro.</p><div class="button-row"><a class="button secondary small" href="data/caso-financeiro-ficticio.csv" download>Exemplo CSV ↓</a><a class="button secondary small" href="data/caso-financeiro-ficticio.jsonl" download>Exemplo JSONL ↓</a></div></section>`;
  }
  function investigation() {
    const tabBody = { timeline, signals, notebook, intro: caseIntro };
    return (
      h(
        "Investigue, evento por evento.",
        "Explore a sequência, entenda os sinais e construa um caderno com fatos, hipóteses e verificações.",
        "DOSSIÊ · LOGS E EVIDÊNCIAS",
        state.fileOpened ? "ARQUIVO LOCAL" : "EXERCÍCIO FICTÍCIO",
      ) +
      caseToolbar() +
      `<div class="stat-grid">${stat("Eventos no recorte", result.events.length)}${stat("Sinais das regras", result.signal_count)}${stat("Transferências registradas", result.transfer_count)}${stat("Valor informado no arquivo", money(result.transfer_total_centavos))}</div><p class="stat-caption">Soma dos valores conhecidos. Não confirma liquidação ou prejuízo. ${result.transfers_without_amount ? `${result.transfers_without_amount} transferência(s) sem valor informado ficam fora da soma.` : ""}</p>${state.case === "arquivo" ? notice(`${state.fileOpened ? "Arquivo validado" : "Exemplo ainda visível — aguardando um arquivo"}: ${e(state.caseName)}. Os registros são processados na memória deste navegador.`) : ""}${result.signals_omitted ? notice(`${result.signal_count} sinais encontrados; exibimos os primeiros ${result.signals.length}. ${result.signals_omitted} sinais foram omitidos da apresentação. Os eventos e totais permanecem completos.`, "warning") : ""}<div class="tabs" aria-label="Etapas da investigação">${[
        ["intro", "Entenda o caso"],
        ["timeline", "Linha do tempo"],
        ["signals", "Sinais e hipóteses"],
        ["notebook", "Meu caderno"],
      ]
        .map(
          ([id, label]) =>
            `<button class="tab" data-action="tab" data-value="${id}" aria-pressed="${state.tab === id}">${label}</button>`,
        )
        .join("")}</div>${tabBody[state.tab]()}`
    );
  }
  function diagnostic() {
    const s = assessment(
        controls,
        state.snapshot.answers,
        state.snapshot.notes,
      ),
      areas = ["Todas", ...new Set(controls.map((c) => c.area))];
    return (
      h(
        "Primeiros ajustes, com um motivo.",
        "Responda o que você sabe, registre evidências e veja o que precisa confirmar. Uma dúvida também vira uma ação.",
        "DIAGNÓSTICO · 18 CONTROLES",
        "DECLARAÇÕES, NÃO AUDITORIA",
      ) +
      `<div class="toolbar"><div class="field"><label for="scenario">Comece por um cenário</label><select id="scenario">${option("loja", "Loja fictícia", state.scenario)}${option("escritorio", "Escritório fictício", state.scenario)}${option("branco", "Avaliação em branco", state.scenario)}${state.scenario === "importado" ? option("importado", "Avaliação importada", state.scenario) : ""}</select></div><div class="field"><label for="company">Nome do cenário</label><input id="company" value="${e(state.snapshot.cenario)}" maxlength="100"></div><a class="button secondary small" href="#plano">Ver meu plano →</a></div><div class="stat-grid">${stat("Atendimento declarado", s.score === null ? "—" : s.score.toFixed(1) + "%")}${stat("Controles implementados", `${s.implemented}/${s.applicable}`)}${stat("Ainda não sabemos", s.unknown)}${stat("Ações para revisar", s.tasks.length)}</div><p class="stat-caption">Pesos e prioridades próprios do exercício. O percentual resume respostas; não mede proteção real ou probabilidade de ataque. Evidências exigem revisão.</p><div class="area-pills" aria-label="Filtrar área">${areas.map((area) => `<button data-action="area" data-value="${e(area)}" aria-pressed="${state.area === area}">${e(area)}</button>`).join("")}</div><div class="checklist">${controls
        .filter((c) => state.area === "Todas" || c.area === state.area)
        .map((c, i) => {
          const current = state.snapshot.answers[c.id] ?? "unknown";
          return `<article class="control-card"><div><span class="eyebrow">${e(c.area)} / ${c.id.toUpperCase()}</span><h3>${e(c.title)}</h3><p>${e(c.question)}</p><p class="control-info"><strong>Próxima ação:</strong> ${e(c.action)}</p><details><summary class="small-text">Que evidência procurar?</summary><p class="control-info">${e(c.evidence)}</p></details></div><div><div class="field"><label for="answer-${c.id}">Como está hoje?</label><select id="answer-${c.id}" data-control="${c.id}">${Object.entries(
            statuses,
          )
            .map(([key, label]) => option(key, label, current))
            .join(
              "",
            )}</select></div><div class="field control-evidence"><label for="evidence-${c.id}">${current === "na" ? "Justificativa obrigatória" : "Evidência ou dúvida"}</label><textarea id="evidence-${c.id}" data-evidence="${c.id}" maxlength="1000" rows="2" placeholder="O que você viu? Quem pode confirmar?">${e(state.snapshot.notes[c.id] ?? "")}</textarea><small>${current === "na" ? "Explique o contexto antes de marcar Não se aplica." : "Registre uma evidência para que a resposta possa ser revisada."}</small></div></div></article>`;
        })
        .join("")}</div>`
    );
  }
  function assets() {
    const list = state.snapshot.assets,
      findings = assetFindings(list);
    return (
      h(
        "Saiba o que precisa proteger.",
        "O inventário conecta dispositivos e serviços às perguntas de segurança. A exposição aqui é declarada, não medida por uma varredura.",
        "INVENTÁRIO · ATIVOS E LACUNAS",
        state.scenario === "loja" || state.scenario === "escritorio"
          ? "CENÁRIO FICTÍCIO"
          : "SUA AVALIAÇÃO",
      ) +
      `<div class="toolbar"><div class="field"><label for="inventory-file">Abrir inventário CSV</label><input id="inventory-file" type="file" accept=".csv" data-upload="inventory"><small>Até 2 MB e 500 ativos · substitui o inventário desta sessão após validação.</small></div><button class="small" data-action="add-asset">Cadastrar ativo +</button><a class="button secondary small" href="data/inventario-exemplo.csv" download>Modelo CSV ↓</a><button class="small secondary" data-action="export-assets">Exportar atual ↓</button></div>${state.assetDraft ? assetForm() : ""}<div class="stat-grid">${stat("Ativos no recorte", list.length)}${stat("Expostos · declarado", list.filter((a) => a.exposto_internet === "sim").length)}${stat("Achados para revisar", findings.length)}${stat("Achados urgentes", findings.filter((f) => f.priority === "Urgente").length)}</div>${notice("Um endereço IP ou uma porta no inventário não comprova exposição real. Confirme as declarações com a equipe e planeje alterações antes de executá-las.")}<section class="panel"><div class="event-table-wrap"><table><caption>Inventário atual · ${e(state.snapshot.cenario)}</caption><thead><tr><th scope="col">Ativo</th><th scope="col">Tipo / zona</th><th scope="col">IP</th><th scope="col">Internet</th><th scope="col">MFA</th><th scope="col">Atualizado</th><th scope="col">Backup testado</th><th scope="col">Portas</th><th scope="col">Editar</th></tr></thead><tbody>${list.map((a, index) => `<tr><td><strong>${e(a.nome)}</strong><br><span class="mono">${e(a.id)}</span></td><td>${e(a.tipo)}<br>${e(a.zona)}</td><td class="mono">${e(a.ip || "Não informado")}</td>${["exposto_internet", "mfa", "atualizado", "backup_testado"].map((f) => `<td>${e(a[f])}</td>`).join("")}<td class="mono">${e(a.portas || "Não informado")}</td><td><button class="small secondary" data-action="edit-asset" data-value="${index}" aria-label="Editar ${e(a.nome)}">Editar</button></td></tr>`).join("") || '<tr><td colspan="9">Sem ativos. Cadastre um dispositivo ou serviço para começar.</td></tr>'}</tbody></table></div></section><section class="section"><div class="section-heading"><h2>O que vale verificar primeiro?</h2><p>Esses achados vêm das declarações do inventário, com critérios explicados.</p></div><div class="grid cols-2">${findings.map((f) => `<article class="panel"><span class="pill ${f.priority === "Urgente" ? "bad" : f.priority === "Alta" ? "warn" : ""}">${f.priority}</span><h3 class="section">${e(f.title)}</h3><p class="mono">${e(f.nome)} / ${e(f.id)}</p><p>${e(f.action)}</p></article>`).join("") || '<div class="empty"><p>Nenhum achado dessas regras. A cobertura do exercício é limitada.</p></div>'}</div></section>`
    );
  }
  function assetForm() {
    const draft = state.assetDraft,
      labels = {
        id: "Identificador único",
        nome: "Nome do ativo",
        tipo: "Tipo",
        zona: "Zona da rede",
        ip: "IP · opcional",
        exposto_internet: "Acessível pela internet?",
        mfa: "MFA disponível e ativo?",
        atualizado: "Está atualizado?",
        backup_testado: "A restauração foi testada?",
        portas: "Portas declaradas · opcional",
      };
    return `<section class="panel asset-editor"><span class="eyebrow">${state.assetIndex < 0 ? "NOVO ATIVO" : "EDITAR ATIVO"}</span><h2>Registre o que você sabe.</h2><p class="muted">Não sabe uma resposta? Marque “Não sei” e confirme depois com o responsável.</p><div class="grid cols-2">${Object.entries(
      labels,
    )
      .map(([key, label]) => {
        const choices =
          key === "tipo"
            ? [
                "computador",
                "servidor",
                "roteador",
                "switch",
                "iot",
                "nuvem",
                "email",
              ]
            : key === "zona"
              ? [
                  "administracao",
                  "interna",
                  "servidores",
                  "visitantes",
                  "iot",
                  "nuvem",
                ]
              : [
                    "exposto_internet",
                    "mfa",
                    "atualizado",
                    "backup_testado",
                  ].includes(key)
                ? ["desconhecido", "sim", "nao"]
                : null;
        const control = choices
          ? `<select id="asset-${key}" data-asset-field="${key}">${choices.map((v) => option(v, v === "desconhecido" ? "Não sei" : v === "nao" ? "Não" : v === "sim" ? "Sim" : v, draft[key])).join("")}</select>`
          : `<input id="asset-${key}" data-asset-field="${key}" value="${e(draft[key])}" maxlength="${key === "id" ? 40 : 200}"${key === "portas" ? ' placeholder="Ex.: 443,3389"' : ""}>`;
        return `<div class="field"><label for="asset-${key}">${label}</label>${control}${key === "id" ? "<small>Letras, números, hífen e sublinhado; sem espaços.</small>" : key === "portas" ? "<small>De 1 a 65535, separadas por vírgula. Apenas uma declaração.</small>" : ""}</div>`;
      })
      .join(
        "",
      )}</div><div class="button-row section"><button class="small" data-action="save-asset">Salvar ativo</button><button class="small secondary" data-action="cancel-asset">Cancelar edição</button></div></section>`;
  }
  function networks() {
    let net, error;
    try {
      net = subnet(state.network.cidr);
    } catch (ex) {
      error = ex.message;
    }
    const zones = [
      "administracao",
      "interna",
      "servidores",
      "visitantes",
      "iot",
      "internet",
    ];
    let decision;
    try {
      decision = policy(
        state.network.source,
        state.network.destination,
        Number(state.network.port),
      );
    } catch {
      decision = null;
    }
    let comparison;
    try {
      comparison = overlaps(
        state.network.compare
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean),
      );
    } catch (ex) {
      comparison = ex.message;
    }
    return (
      h(
        "Redes que você consegue explicar.",
        "Explore endereços e regras de segmentação. Cada resultado mostra o motivo e ajuda você a entender o caminho.",
        "LABORATÓRIO · REDES E SEGMENTAÇÃO",
        "SIMULAÇÃO OFFLINE",
      ) +
      notice(
        "Este laboratório calcula endereços e simula uma política TCP. Ele não escaneia redes, testa conexões ou configura um firewall.",
      ) +
      `<div class="grid cols-2"><section class="panel"><span class="eyebrow">EXERCÍCIO 01 / ENDEREÇOS</span><h2>Entenda uma rede CIDR.</h2><div class="field"><label for="cidr">Endereço e prefixo</label><input id="cidr" data-network="cidr" value="${e(state.network.cidr)}" maxlength="50" placeholder="192.0.2.0/24"></div>${error ? notice(e(error), "error") : `${net.normalized ? notice(`O endereço informado está dentro da rede ${e(net.cidr)}. O cálculo usa o endereço de rede normalizado.`) : ""}<div class="address-grid section"><div><small>Rede normalizada</small><strong>${e(net.cidr)}</strong></div><div><small>Endereços no bloco</small><strong>${net.size.toLocaleString("pt-BR")}</strong></div><div><small>Hosts no modelo</small><strong>${net.usable.toLocaleString("pt-BR")}</strong></div><div><small>Primeiro host</small><strong>${e(net.first)}</strong></div><div><small>Último host</small><strong>${e(net.lastHost)}</strong></div><div><small>${net.version === 4 ? "Broadcast" : "IPv6"}</small><strong>${e(net.broadcast ?? "Sem broadcast")}</strong></div></div><p class="small-text muted section">${net.version === 4 ? "Em IPv4, /31 e /32 têm regras próprias de contagem. O cálculo não informa quantos dispositivos estão conectados." : "IPv6 não usa broadcast. A contagem descreve o bloco de endereços, não o uso real da rede."}</p>`}</section><section class="panel"><span class="eyebrow">EXERCÍCIO 02 / SEGMENTAÇÃO</span><h2>Esse caminho é permitido?</h2><div class="grid cols-2"><div class="field"><label for="network-source">Origem</label><select id="network-source" data-network="source">${zones.map((z) => option(z, z, state.network.source)).join("")}</select></div><div class="field"><label for="network-destination">Destino</label><select id="network-destination" data-network="destination">${zones.map((z) => option(z, z, state.network.destination)).join("")}</select></div></div><div class="field section"><label for="network-port">Porta TCP</label><input id="network-port" type="number" data-network="port" min="1" max="65535" value="${e(state.network.port)}"></div>${decision ? `<div class="network-path"><div class="network-node">${e(state.network.source)}</div><span class="network-arrow" aria-hidden="true">→</span><div class="network-node ${decision.allowed ? "allow" : "deny"}">${decision.allowed ? "Permitido" : "Negado"}<br><span class="mono">TCP ${e(state.network.port)}</span></div><span class="network-arrow" aria-hidden="true">→</span><div class="network-node">${e(state.network.destination)}</div></div>${notice(decision.reason, decision.allowed ? "" : "warning")}` : notice("Informe uma porta inteira de 1 a 65535.", "error")}<details><summary>Ver todas as permissões do exercício</summary><p class="small-text section">Administração → servidores: TCP 22 e 443.<br>Rede interna → servidores: TCP 443.<br>Administração, interna e visitantes → internet: TCP 443.<br>Todos os outros caminhos: negados por padrão.</p><p class="small-text muted">É uma política simplificada. Uma política real precisa considerar serviços, tráfego de retorno e necessidades da empresa.</p></details></section></div><section class="panel section"><span class="eyebrow">EXERCÍCIO 03 / SOBREPOSIÇÃO</span><h2>Essas redes se sobrepõem?</h2><div class="grid cols-2"><div class="field"><label for="compare-networks">Uma rede por linha · até 20</label><textarea id="compare-networks" data-network="compare" maxlength="1200" rows="4">${e(state.network.compare)}</textarea><small>Blocos IPv4 e IPv6 são comparados dentro da mesma versão.</small></div><div>${typeof comparison === "string" ? notice(e(comparison), "error") : comparison.length ? notice(comparison.map((pair) => `<span class="mono">${e(pair[0])} ↔ ${e(pair[1])}</span>`).join("<br>"), "warning") : notice("Não há sobreposição entre os blocos informados.")}<p class="small-text muted">Sobreposição pode ser intencional, mas merece revisão do endereçamento e das rotas.</p></div></div></section>`
    );
  }
  function plan() {
    const s = assessment(
        controls,
        state.snapshot.answers,
        state.snapshot.notes,
      ),
      findings = assetFindings(state.snapshot.assets);
    return (
      h(
        "Dê um destino às suas dúvidas.",
        "Use as lacunas declaradas para planejar ações, definir responsáveis e registrar como verificar o resultado.",
        "MEU PLANO · PRÓXIMOS AJUSTES",
      ) +
      `<div class="button-row"><button data-action="export-assessment">Avaliação JSON ↓</button><button class="secondary" data-action="export-plan">Plano CSV ↓</button><button class="secondary" data-action="export-plan-html">Relatório HTML ↓</button><button class="ghost" data-action="reset">Limpar sessão</button></div><div class="field section"><label for="assessment-file">Restaurar avaliação JSON · até 2 MB</label><input id="assessment-file" type="file" accept=".json" data-upload="assessment"><small>Validação de versão, estados, justificativas e inventário antes de substituir a avaliação.</small></div>${notice("Prioridades e prazos são sugestões do exercício. Revise impacto, dependências e responsáveis antes de alterar um serviço.")}<div class="grid cols-2"><section class="panel"><span class="eyebrow">${e(state.snapshot.cenario)}</span><h2>${s.score === null ? "Sem controles aplicáveis" : s.score.toFixed(1) + "% de atendimento declarado"}</h2><p class="muted">O percentual resume as respostas ponderadas. Não representa proteção real ou uma auditoria.</p><p>${s.unknown} controles desconhecidos · ${s.tasks.length} ações nos controles · ${findings.length} achados do inventário</p><a class="text-link" href="#diagnostico">Revisar minhas respostas →</a></section><section class="panel"><span class="eyebrow">ÁREAS DO DIAGNÓSTICO</span><div class="area-progress">${s.areas.map((a) => `<div><label for="progress-${e(a.area)}">${e(a.area)}<span>${a.score}%</span></label><progress id="progress-${e(a.area)}" class="progress-native" max="100" value="${a.score}">${a.score}%</progress></div>`).join("") || "<p>Todos os controles foram declarados como não aplicáveis.</p>"}</div></section></div><section class="section"><div class="section-heading"><h2>Um plano que dá para conferir.</h2><p>Comece pela situação declarada, registre uma evidência e defina quem vai acompanhar cada ajuste.</p></div><div class="plan-list">${s.tasks.map((task, i) => `<article class="plan-row"><span class="number-label">${String(i + 1).padStart(2, "0")}</span><div><h3>${e(task.title)}</h3><p>${e(task.action)}</p><p class="small-text section"><strong>Como verificar:</strong> ${e(task.evidence)}</p><span class="pill ${task.priority === "Alta" ? "warn" : ""}">${task.priority} · ${e(statuses[task.state])}</span></div><span class="plan-day">Em até ${task.days} dias*</span></article>`).join("") || '<div class="empty"><p>Não há ações pendentes nos controles declarados com evidência. Continue revisando as evidências e os ativos.</p></div>'}</div><p class="stat-caption">* Prazo sugerido para organizar o estudo e o planejamento. Confirme a viabilidade com a equipe.</p></section>${findings.length ? `<section class="section"><div class="section-heading"><h2>Inclua os ativos no planejamento.</h2><a href="#inventario" class="text-link">Revisar inventário →</a></div><div class="plan-list">${findings.map((f) => `<article class="plan-row"><span class="pill ${f.priority === "Urgente" ? "bad" : "warn"}">${f.priority}</span><div><h3>${e(f.nome)} · ${e(f.title)}</h3><p>${e(f.action)}</p></div><span class="mono">${e(f.id)}</span></article>`).join("")}</div></section>` : ""}`
    );
  }
  function planHTML() {
    const s = assessment(
        controls,
        state.snapshot.answers,
        state.snapshot.notes,
      ),
      findings = assetFindings(state.snapshot.assets);
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>NetGuard Lab · Plano</title><style>body{font:16px/1.6 system-ui;color:#1b231d;max-width:900px;margin:40px auto;padding:0 24px}h1,h2{color:#2f6b3f}article{border:1px solid #d1c09f;padding:18px;margin:14px 0;break-inside:avoid}.note{white-space:pre-wrap}</style><h1>NetGuard Lab · ${e(state.snapshot.cenario)}</h1><p>Atendimento declarado: ${s.score === null ? "sem controles aplicáveis" : s.score.toFixed(1) + "%"}. Resumo de respostas com pesos próprios; não mede proteção real.</p><p>Prioridades e prazos sugeridos. Revise contexto, dependências e responsáveis antes de alterar um serviço.</p><h2>Diagnóstico e plano</h2>${controls
      .map((c) => {
        const answer = state.snapshot.answers[c.id] ?? "unknown";
        return `<article><h3>${e(c.title)} · ${e(c.area)}</h3><p>Estado: ${e(statuses[answer])}</p><p class="note">Evidência ou justificativa: ${e(state.snapshot.notes[c.id] || "Não registrada.")}</p><p>Próxima ação: ${e(s.tasks.find((t) => t.id === c.id)?.action || "Revisar periodicamente a evidência.")}</p><p>Como verificar: ${e(c.evidence)} · Prazo sugerido: ${c.days} dias.</p></article>`;
      })
      .join(
        "",
      )}<h2>Achados do inventário</h2>${findings.map((f) => `<article><h3>${e(f.nome)} · ${e(f.title)}</h3><p>${e(f.priority)} · ${e(f.action)}</p></article>`).join("") || "<p>Nenhum achado das regras do exercício.</p>"}</html>`;
  }
  const views = {
    inicio: home,
    aprender: learning,
    investigar: investigation,
    diagnostico: diagnostic,
    inventario: assets,
    redes: networks,
    plano: plan,
  };
  function render(preserve = false) {
    const active = doc.activeElement,
      focusId = preserve ? active?.id : null,
      focusAction = active?.dataset.action,
      focusValue = active?.dataset.value,
      selection =
        focusId && "selectionStart" in active
          ? [active.selectionStart, active.selectionEnd]
          : null;
    main.innerHTML = views[state.route]();
    main.classList.remove("reveal");
    if (!preserve) main.classList.add("reveal");
    doc.title = `${LABELS[state.route]} · NetGuard Lab`;
    doc.querySelectorAll("#navigation a").forEach((a) => {
      if (a.hash === "#" + state.route) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (focusId) {
      const element = doc.getElementById(focusId);
      element?.focus({ preventScroll: true });
      if (selection && element?.setSelectionRange)
        try {
          element.setSelectionRange(...selection);
        } catch {
          /* campos numéricos não têm seleção */
        }
    } else if (focusAction) {
      const element = [...main.querySelectorAll("[data-action]")].find(
        (node) =>
          node.dataset.action === focusAction &&
          node.dataset.value === focusValue,
      );
      if (element && !element.disabled) element.focus({ preventScroll: true });
      else main.focus({ preventScroll: true });
    }
  }
  function navigate() {
    const route = win.location.hash.slice(1);
    state.route = ROUTES.includes(route) ? route : "inicio";
    render();
    doc.getElementById("navigation").classList.remove("open");
    doc.getElementById("menu-button").setAttribute("aria-expanded", "false");
    main.focus({ preventScroll: true });
    win.scrollTo?.({ top: 0, behavior: state.reduced ? "instant" : "smooth" });
  }
  function motion() {
    doc.documentElement.dataset.reducedMotion = String(state.reduced);
    const button = doc.getElementById("motion-button");
    button.setAttribute("aria-pressed", String(state.reduced));
    button.setAttribute(
      "aria-label",
      state.reduced ? "Ativar animações" : "Reduzir animações",
    );
    button.title = state.reduced ? "Ativar animações" : "Reduzir animações";
    doc.getElementById("motion-label").textContent = state.reduced
      ? "Movimento reduzido"
      : "Movimento";
  }
  doc.getElementById("menu-button").addEventListener("click", () => {
    const nav = doc.getElementById("navigation"),
      open = nav.classList.toggle("open");
    doc
      .getElementById("menu-button")
      .setAttribute("aria-expanded", String(open));
  });
  doc.getElementById("motion-button").addEventListener("click", () => {
    state.reduced = !state.reduced;
    motion();
    notify(
      state.reduced
        ? "Animações reduzidas nesta sessão."
        : "Movimento ativado; a preferência de acessibilidade do sistema continua sendo respeitada.",
    );
  });
  win.addEventListener("hashchange", navigate);
  doc.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action,
      value = button.dataset.value;
    try {
      if (action === "flip") state.flipped = !state.flipped;
      else if (action === "field") state.selectedField = value;
      else if (action === "learn-prev")
        state.learnStep = Math.max(0, state.learnStep - 1);
      else if (action === "learn-next")
        state.learnStep = Math.min(3, state.learnStep + 1);
      else if (action === "tab") {
        state.tab = value;
        state.signalPage = 0;
      } else if (action === "show-signals") state.tab = "signals";
      else if (action === "show-timeline") state.tab = "timeline";
      else if (action === "select-event" || action === "evidence") {
        const index = result.events.findIndex((ev) => ev.event_id === value);
        if (index >= 0) state.selected = index;
        if (action === "evidence") {
          state.tab = "timeline";
          state.search = "";
          state.source = "todas";
          state.outcome = "todos";
          state.page = Math.floor(index / 30);
        }
      } else if (action === "event-prev")
        state.selected = Math.max(0, state.selected - 1);
      else if (action === "event-next")
        state.selected = Math.min(result.events.length - 1, state.selected + 1);
      else if (action === "page-prev") state.page = Math.max(0, state.page - 1);
      else if (action === "page-next") state.page++;
      else if (action === "signal-prev")
        state.signalPage = Math.max(0, state.signalPage - 1);
      else if (action === "signal-next") state.signalPage++;
      else if (action === "clear-filters") {
        state.search = "";
        state.source = "todas";
        state.outcome = "todos";
        state.page = 0;
      } else if (action === "area") state.area = value;
      else if (action === "add-asset") {
        if (state.snapshot.assets.length >= 500)
          throw new Error("O inventário aceita até 500 ativos.");
        state.assetIndex = -1;
        let serial = state.snapshot.assets.length + 1;
        while (state.snapshot.assets.some((a) => a.id === "ativo-" + serial))
          serial++;
        state.assetDraft = {
          id: "ativo-" + serial,
          nome: "",
          tipo: "computador",
          zona: "interna",
          ip: "",
          exposto_internet: "desconhecido",
          mfa: "desconhecido",
          atualizado: "desconhecido",
          backup_testado: "desconhecido",
          portas: "",
        };
      } else if (action === "edit-asset") {
        state.assetIndex = Number(value);
        state.assetDraft = { ...state.snapshot.assets[state.assetIndex] };
      } else if (action === "cancel-asset") state.assetDraft = null;
      else if (action === "save-asset") {
        const rows = state.snapshot.assets.map((a) => ({ ...a }));
        if (state.assetIndex < 0) rows.push(state.assetDraft);
        else rows[state.assetIndex] = state.assetDraft;
        state.snapshot.assets = normalizeAssets(rows);
        state.assetDraft = null;
        notify("Ativo validado e salvo. Os achados foram recalculados.");
      } else if (action === "export-timeline") {
        download(
          safeCSV(filtered()),
          "netguard-linha-do-tempo.csv",
          "text/csv;charset=utf-8",
        );
        return;
      } else if (action === "export-notebook") {
        download(
          JSON.stringify(
            makeNotebook(result, notes(), state.caseName),
            null,
            2,
          ),
          "netguard-caderno-investigacao.json",
        );
        return;
      } else if (action === "export-investigation") {
        download(
          investigationHTML(result, notes(), state.caseName),
          "netguard-investigacao.html",
          "text/html;charset=utf-8",
        );
        return;
      } else if (action === "export-assessment") {
        download(
          JSON.stringify(state.snapshot, null, 2),
          "netguard-avaliacao.json",
        );
        return;
      } else if (action === "export-plan") {
        const tasks = assessment(
          controls,
          state.snapshot.answers,
          state.snapshot.notes,
        ).tasks.map((t) => ({
          id: t.id,
          area: t.area,
          controle: t.title,
          prioridade: t.priority,
          prazo_dias: t.days,
          acao: t.action,
          evidencia: t.evidence,
        }));
        const findings = assetFindings(state.snapshot.assets).map((f) => ({
          id: f.id,
          area: "Inventário",
          controle: f.nome + " · " + f.title,
          prioridade: f.priority,
          prazo_dias: "Revisar",
          acao: f.action,
          evidencia:
            "Confirmar declaração e registrar a revisão com o responsável.",
        }));
        download(
          safeCSV(
            [...tasks, ...findings],
            [
              "id",
              "area",
              "controle",
              "prioridade",
              "prazo_dias",
              "acao",
              "evidencia",
            ],
          ),
          "netguard-plano.csv",
          "text/csv;charset=utf-8",
        );
        return;
      } else if (action === "export-plan-html") {
        download(planHTML(), "netguard-plano.html", "text/html;charset=utf-8");
        return;
      } else if (action === "export-assets") {
        download(
          safeCSV(state.snapshot.assets, [
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
          ]),
          "netguard-inventario.csv",
          "text/csv;charset=utf-8",
        );
        return;
      } else if (action === "reset") {
        doc.getElementById("reset-dialog").showModal();
        return;
      } else if (action === "cancel-reset") {
        doc.getElementById("reset-dialog").close();
        return;
      } else if (action === "confirm-reset") {
        state.sequence++;
        state.notebooks.clear();
        state.assetDraft = null;
        state.snapshot = {
          schema_version: 1,
          cenario: "Minha avaliação",
          answers: {},
          notes: {},
          assets: [],
        };
        state.scenario = "branco";
        state.area = "Todas";
        state.case = "financeiro";
        state.caseName = CASES.financeiro.name;
        state.parsed = examples.financeiro;
        state.fileOpened = false;
        state.shared = true;
        state.threshold = 15000;
        state.selected = 6;
        state.selectedField = "usuario";
        state.search = "";
        state.source = "todas";
        state.outcome = "todos";
        state.page = 0;
        state.signalPage = 0;
        state.tab = "timeline";
        state.busy = false;
        recalculate();
        doc.getElementById("reset-dialog").close();
        notify("Sessão limpa. Os exemplos fictícios continuam disponíveis.");
      }
      render();
      if (action === "add-asset" || action === "edit-asset")
        doc.getElementById("asset-nome")?.focus();
    } catch (ex) {
      notify(ex.message, true);
    }
  });
  doc.addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.assetField) {
      state.assetDraft[target.dataset.assetField] = target.value;
      return;
    }
    if (target.dataset.note) {
      notes()[target.dataset.note] = target.value;
      doc.getElementById("count-" + target.dataset.note).textContent =
        `${target.value.length} / 3.000`;
      return;
    }
    if (target.dataset.evidence) {
      if (
        state.snapshot.answers[target.dataset.evidence] === "na" &&
        !target.value.trim()
      ) {
        notify(
          "Mantenha a justificativa ou altere a resposta Não se aplica.",
          true,
        );
        return;
      }
      state.snapshot.notes[target.dataset.evidence] = target.value;
      return;
    }
    if (target.id === "company") {
      state.snapshot.cenario = target.value.trim() || "Minha avaliação";
      return;
    }
    if (target.id === "search") {
      state.search = target.value;
      state.page = 0;
      render(true);
      return;
    }
    if (target.id === "timeline-slider") {
      state.selected = Number(target.value);
      state.page = Math.floor(state.selected / 30);
      doc.querySelector(".timeline-controls .counter").textContent =
        `${state.selected + 1} / ${result.events.length}`;
    }
  });
  doc.addEventListener("change", async (event) => {
    const target = event.target;
    try {
      if (target.dataset.upload) {
        const file = target.files?.[0];
        if (!file) return;
        if (!file.size || file.size > MAX_BYTES)
          throw new Error("Use um arquivo UTF-8 de até 2 MB.");
        const sequence = ++state.sequence;
        state.busy = true;
        notify("Validando o arquivo neste navegador…");
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (sequence !== state.sequence) return;
        if (target.dataset.upload === "logs") {
          const extension = file.name.split(".").at(-1).toLowerCase();
          if (!["csv", "jsonl"].includes(extension))
            throw new Error("Escolha CSV ou JSONL.");
          const parsed = await parseEvents(bytes, extension);
          if (sequence !== state.sequence) return;
          state.parsed = parsed;
          state.case = "arquivo";
          state.fileOpened = true;
          state.caseName = file.name.slice(0, 100) || "Arquivo local";
          state.shared = false;
          state.selected = 0;
          state.search = "";
          state.source = "todas";
          state.outcome = "todos";
          state.page = 0;
          state.signalPage = 0;
          recalculate();
          notify(
            "Arquivo validado. A correlação entre fontes está desativada até você confirmar as sessões.",
          );
        } else {
          let source;
          try {
            source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            throw new Error("O arquivo precisa usar UTF-8.");
          }
          if (target.dataset.upload === "notebook") {
            const restored = restoreNotebook(source, result);
            state.notebooks.set(result.sha256, { ...restored.notas });
            state.threshold = restored.limiar_transferencia_brl;
            state.shared = restored.ids_sessao_compativeis;
            state.signalPage = 0;
            recalculate();
            notify(
              "Caderno restaurado para este recorte, com notas e parâmetros.",
            );
          } else if (target.dataset.upload === "assessment") {
            const restored = restoreAssessment(source, controls);
            state.snapshot = restored;
            state.assetDraft = null;
            state.scenario = "importado";
            state.area = "Todas";
            notify("Avaliação validada e restaurada.");
          } else if (target.dataset.upload === "inventory") {
            state.snapshot.assets = inventory(bytes);
            state.assetDraft = null;
            notify("Inventário validado e substituído nesta sessão.");
          }
        }
        state.busy = false;
        render();
        return;
      }
      if (target.id === "case-select") {
        state.sequence++;
        state.case = target.value;
        state.busy = false;
        if (state.case === "arquivo") {
          state.shared = false;
          notify(
            "Abra um arquivo para substituir o recorte. O exemplo atual permanece identificado até a importação.",
          );
        } else {
          state.parsed = examples[state.case];
          state.fileOpened = false;
          state.caseName = CASES[state.case].name;
          state.shared = true;
          state.selected = 0;
          state.search = "";
          state.source = "todas";
          state.outcome = "todos";
          state.page = 0;
          state.signalPage = 0;
        }
        recalculate();
      } else if (target.id === "threshold") {
        const threshold = Number(target.value);
        if (
          !Number.isSafeInteger(threshold) ||
          threshold < 1 ||
          threshold > 1000000000
        )
          throw new Error(
            "Informe um limiar inteiro de 1 a 1 bilhão de reais.",
          );
        state.threshold = threshold;
        state.signalPage = 0;
        recalculate();
      } else if (target.id === "shared") {
        state.shared = target.checked;
        state.signalPage = 0;
        recalculate();
      } else if (target.id === "timeline-slider") {
        state.selected = Number(target.value);
        state.page = Math.floor(state.selected / 30);
      } else if (target.id === "source-filter") {
        state.source = target.value;
        state.page = 0;
      } else if (target.id === "outcome-filter") {
        state.outcome = target.value;
        state.page = 0;
      } else if (target.id === "scenario") {
        state.sequence++;
        state.assetDraft = null;
        if (target.value === "branco")
          state.snapshot = {
            schema_version: 1,
            cenario: "Minha avaliação",
            answers: {},
            notes: {},
            assets: [],
          };
        else
          state.snapshot = restoreAssessment(snapshots[target.value], controls);
        state.scenario = target.value;
        state.area = "Todas";
        notify(
          "Cenário carregado. As notas dos casos de investigação foram preservadas.",
        );
      } else if (target.dataset.control) {
        const id = target.dataset.control;
        if (target.value === "na" && !state.snapshot.notes[id]?.trim()) {
          target.value = state.snapshot.answers[id] ?? "unknown";
          throw new Error(
            "Escreva a justificativa no campo de evidência antes de marcar Não se aplica.",
          );
        }
        state.snapshot.answers[id] = target.value;
      } else if (target.dataset.evidence) {
        if (
          state.snapshot.answers[target.dataset.evidence] === "na" &&
          !target.value.trim()
        )
          throw new Error(
            "Uma resposta Não se aplica precisa manter a justificativa.",
          );
      } else if (target.dataset.network)
        state.network[target.dataset.network] = target.value;
      else if (target.dataset.assetField)
        state.assetDraft[target.dataset.assetField] = target.value;
      render(true);
    } catch (ex) {
      state.busy = false;
      notify(ex.message, true);
    }
  });
  motion();
  render();
  return {
    state,
    get result() {
      return result;
    },
    render,
    notify,
    destroy() {
      win.clearTimeout(toastTimer);
      win.removeEventListener("hashchange", navigate);
    },
  };
}

if (typeof document !== "undefined" && document.getElementById("main")) {
  createApp(document).catch((error) => {
    document.getElementById("main").innerHTML =
      `<div class="loading"><h1>Não foi possível abrir o laboratório.</h1><p>${e(error.message)}</p><p>Recarregue a página ou acesse o código e os guias no GitHub.</p><a class="button" href="https://github.com/bruno-dsn/bruno-dsn/tree/netguard-lab">Abrir o projeto ↗</a></div>`;
  });
}
