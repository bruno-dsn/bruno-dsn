"""Aplicação local do NetGuard Lab. Execute: python -m streamlit run app.py."""

from pathlib import Path
import html
import sys

import altair as alt
import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))
from netguard.assessment import assess  # noqa: E402
from netguard.controls import CONTROLS, STATUS_LABELS  # noqa: E402
from netguard.inventory import FIELDS, STATES, TYPES, ZONES, normalize_inventory, read_inventory  # noqa: E402
from netguard.logs import analyze_auth_csv  # noqa: E402
from netguard.investigation import format_brl, investigate  # noqa: E402
from netguard.learning import FIELD_GUIDE, explain_event  # noqa: E402
from netguard.notebook import decode_notebook, encode_notebook, investigation_report  # noqa: E402
from netguard.network import ZONES as POLICY_ZONES, overlap_pairs, policy_decision, subnet_info  # noqa: E402
from netguard.reports import action_plan, decode_snapshot, encode_snapshot, html_report, safe_csv  # noqa: E402


st.set_page_config(page_title="NetGuard Lab · Primeiros ajustes", page_icon="🛡️", layout="wide")
st.markdown(
    """<style>
.stApp{background:#f7eacb}.block-container{max-width:1390px;padding-top:3.8rem;padding-bottom:4rem}
.brand{display:flex;align-items:center;gap:9px;font-size:1.15rem;font-weight:750;margin-bottom:12px}
[data-testid="stSidebar"]{background:white;border-right:1px solid #d1c09f}
.workspace{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:0 0 17px;border-bottom:1px solid #d1c09f;font-size:.78rem;color:#647583;margin-bottom:18px}
.workspace span{padding:4px 9px;border:1px solid #c8dad6;border-radius:6px;color:#076f64;background:#edf3e5}
.hero{background:#1b231d;border-radius:12px;padding:26px 30px;border-left:4px solid #ffd23f;margin-bottom:20px}
.hero h1{color:#fffdf6;margin:5px 0 10px;font-size:clamp(1.8rem,2.7vw,2.55rem);line-height:1.2;letter-spacing:-.035em}
.hero p{color:#e8d5a6;font-size:.96rem;max-width:930px;margin:0;line-height:1.65}.kicker{font-size:.69rem;font-weight:700;letter-spacing:.13em;color:#ffd23f}
h1{font-size:2rem;letter-spacing:-.035em}h2{font-size:1.35rem}h3{font-size:1.1rem}
[data-testid="stMetric"]{border:1px solid #d1c09f;border-radius:10px;background:white;padding:16px 20px;min-height:112px}
[data-testid="stMetricLabel"]{color:#52687a;font-size:.8rem}[data-testid="stMetricValue"]{font-size:1.9rem;color:#1b231d;font-variant-numeric:tabular-nums}
[data-testid="stDataFrame"]{border:1px solid #d1c09f;border-radius:10px;overflow:hidden}
.stButton>button,.stDownloadButton>button{border-radius:7px;min-height:42px;font-weight:600}
.stApp button:focus-visible,.stApp a:focus-visible,.stApp input:focus-visible{outline:3px solid #008c4c;outline-offset:3px}
@media(max-width:900px){.block-container{padding-left:1rem;padding-right:1rem}.hero{padding:20px}[data-testid="stHorizontalBlock"]{flex-wrap:wrap}[data-testid="stHorizontalBlock"]>[data-testid="stColumn"]{min-width:min(230px,100%);flex:1 1 230px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>""",
    unsafe_allow_html=True,
)


def restore(data, mode):
    st.session_state.answers = data["answers"]
    st.session_state.notes = data["notes"]
    st.session_state.assets = data["assets"]
    st.session_state.company = data["cenario"]
    st.session_state.mode = mode
    for control in CONTROLS:
        st.session_state.pop(f"answer_{control.id}", None)
        st.session_state.pop(f"note_{control.id}", None)
    st.session_state.pop("inventory_editor", None)


def select_scenario():
    scenario = st.session_state.scenario
    if scenario == "Avaliação em branco":
        restore({"answers": {}, "notes": {}, "assets": [], "cenario": "Minha avaliação"}, "Avaliação em branco")
    else:
        file = "cenario-loja.json" if scenario == "Loja fictícia" else "cenario-escritorio.json"
        restore(decode_snapshot((ROOT / "data" / file).read_bytes()), "Cenário fictício")


def save_answer(control_id):
    st.session_state.answers[control_id] = st.session_state[f"answer_{control_id}"]


def save_note(control_id):
    st.session_state.notes[control_id] = st.session_state[f"note_{control_id}"]


def import_snapshot():
    try:
        restore(decode_snapshot(st.session_state.restore_file.getvalue()), "Arquivo importado")
        st.session_state.pop("restore_error", None)
    except ValueError as error:
        st.session_state.restore_error = str(error)


def save_investigation_note(prefix, field):
    notebooks = st.session_state.setdefault("investigation_notebooks", {})
    notebooks.setdefault(prefix, {})[field] = st.session_state[f"investigation_{prefix}_{field}"]


def import_investigation_notebook(prefix, investigation, case):
    try:
        restored = decode_notebook(st.session_state.notebook_restore_file.getvalue(), investigation)
        st.session_state.setdefault("investigation_notebooks", {})[prefix] = restored["notas"]
        for field, value in restored["notas"].items():
            st.session_state[f"investigation_{prefix}_{field}"] = value
        st.session_state.investigation_threshold = restored["limiar_transferencia_brl"]
        st.session_state[f"session_namespace_{case}"] = restored["ids_sessao_compativeis"]
        st.session_state.pop("notebook_restore_error", None)
    except ValueError as error:
        st.session_state.notebook_restore_error = str(error)


if "answers" not in st.session_state:
    restore(decode_snapshot((ROOT / "data/cenario-loja.json").read_bytes()), "Cenário fictício")

with st.sidebar:
    st.markdown(
        '<div class="brand"><svg width="27" height="30" viewBox="0 0 24 27" aria-hidden="true"><path fill="#008c4c" d="M12 1 22 5v8c0 6-4 10-10 13C6 23 2 19 2 13V5z"/><path d="m7 13 3 3 7-7" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><strong>NetGuard Lab</strong></div>',
        unsafe_allow_html=True,
    )
    st.caption("PRIMEIROS AJUSTES · REDES E SEGURANÇA")
    page = st.radio(
        "Área de trabalho",
        [
            "Visão geral",
            "Diagnóstico guiado",
            "Inventário",
            "Laboratório de redes",
            "Investigar logs",
            "Plano e relatório",
            "Trilha de estudo",
        ],
        key="page",
    )
    st.divider()
    st.selectbox(
        "Comece com um cenário",
        ["Loja fictícia", "Escritório fictício", "Avaliação em branco"],
        key="scenario",
        on_change=select_scenario,
    )
    st.text_input("Nome do cenário", key="company", max_chars=100)
    with st.expander("Restaurar avaliação"):
        upload = st.file_uploader("JSON exportado · até 2 MB", type="json", key="restore_file")
        st.button("Restaurar JSON", disabled=upload is None, on_click=import_snapshot)
        if st.session_state.get("restore_error"):
            st.error(st.session_state.restore_error)
    st.caption("O trabalho fica na sessão. Exporte o JSON para continuar em outro momento. Os exemplos são fictícios.")

answers, notes, assets = st.session_state.answers, st.session_state.notes, st.session_state.assets
st.markdown(
    f'<div class="workspace"><strong>{html.escape(st.session_state.company)} / {html.escape(page)}</strong><span>{html.escape(st.session_state.mode)}</span></div>',
    unsafe_allow_html=True,
)
try:
    summary = assess(answers, notes)
except ValueError as error:
    summary = None
    st.warning(str(error))


if page == "Visão geral":
    st.markdown(
        """<section class="hero"><div class="kicker">SEGURANÇA COMEÇA COM VISIBILIDADE</div><h1>Descubra o que precisa de atenção primeiro.</h1><p>Organize os ativos, responda um diagnóstico e transforme as lacunas em um plano explicado. Aprenda redes e segurança enquanto investiga um cenário de pequena empresa.</p></section>""",
        unsafe_allow_html=True,
    )
    if summary:
        cards = st.columns(4)
        cards[0].metric("Atendimento declarado", "—" if summary["score"] is None else f"{summary['score']:.1f}%")
        cards[1].metric("Controles implementados", f"{summary['implemented']}/{summary['applicable']}")
        cards[2].metric("Ainda não sabemos", summary["unknown"])
        cards[3].metric("Ativos no inventário", len(assets))
        st.caption(
            "O percentual resume respostas com pesos próprios. Não mede proteção real ou probabilidade de ataque; evidências precisam de revisão."
        )
        left, right = st.columns([1.4, 1])
        with left:
            st.subheader("Primeiras prioridades")
            plan = action_plan(answers, notes, assets)
            if plan:
                st.dataframe(
                    pd.DataFrame(plan)[["prioridade", "item", "motivo"]].head(6), hide_index=True, width="stretch"
                )
            else:
                st.info(
                    "Não há pendências nas regras deste exercício. Confirme as declarações e a abrangência com a equipe."
                )
            st.caption("Abra Plano e relatório para ler as ações e os prazos sugeridos.")
        with right:
            st.subheader("O que foi declarado por área")
            if summary["areas"]:
                chart = (
                    alt.Chart(pd.DataFrame(summary["areas"]))
                    .mark_bar(color="#008C4C", cornerRadiusEnd=3)
                    .encode(
                        x=alt.X(
                            "atendimento_pct:Q", title="Atendimento declarado (%)", scale=alt.Scale(domain=[0, 100])
                        ),
                        y=alt.Y("area:N", title=None, sort=None),
                        tooltip=["area", alt.Tooltip("atendimento_pct:Q", format=".1f")],
                    )
                    .properties(height=265)
                )
                st.altair_chart(chart, width="stretch")
            st.caption("As seis áreas organizam o estudo inspirado no NIST CSF 2.0. O catálogo de controles é próprio.")
    st.subheader("Uma boa primeira sessão")
    for col, title, copy in zip(
        st.columns(3),
        ["01 · Conheça o cenário", "02 · Teste uma hipótese", "03 · Registre a decisão"],
        [
            "Abra o inventário. Procure um serviço exposto e confirme quais informações faltam.",
            "No laboratório, simule o acesso de visitantes a um servidor. Compare a regra com o isolamento planejado.",
            "Preencha o diagnóstico e exporte um plano. Anote evidências, responsável e prazo antes de executar mudanças.",
        ],
    ):
        with col, st.container(border=True):
            st.markdown(f"**{title}**")
            st.write(copy)

elif page == "Diagnóstico guiado":
    st.title("O que já existe? O que ainda precisamos confirmar?")
    st.write(
        "Responda por área. Use Não sei quando faltar informação e registre uma evidência ou justificativa. Não se aplica exige uma justificativa."
    )
    for area in dict.fromkeys(control.area for control in CONTROLS):
        with st.expander(area, expanded=area == "Proteger"):
            for control in [item for item in CONTROLS if item.area == area]:
                st.markdown(f"**{control.title}**")
                st.write(control.question)
                status = st.session_state.answers.get(control.id, "unknown")
                st.selectbox(
                    "Estado do controle",
                    list(STATUS_LABELS),
                    index=list(STATUS_LABELS).index(status),
                    format_func=STATUS_LABELS.get,
                    key=f"answer_{control.id}",
                    on_change=save_answer,
                    args=(control.id,),
                )
                st.text_input(
                    "Evidência ou justificativa",
                    value=notes.get(control.id, ""),
                    max_chars=1000,
                    key=f"note_{control.id}",
                    help=control.evidence,
                    on_change=save_note,
                    args=(control.id,),
                )
                st.caption("Próximo ajuste: " + control.action)
                st.divider()

elif page == "Inventário":
    st.title("Veja quais ativos sustentam a empresa.")
    st.write(
        "Edite a tabela ou importe um CSV do exemplo. Exposição, MFA e atualização são informações declaradas; nenhum equipamento será sondado."
    )
    upload = st.file_uploader("Inventário CSV · até 2 MB e 500 ativos", type="csv")
    if st.button("Usar CSV", disabled=upload is None):
        try:
            st.session_state.assets = read_inventory(upload.getvalue())
            st.session_state.pop("inventory_editor", None)
            st.rerun()
        except ValueError as error:
            st.error(str(error))
    st.download_button(
        "Baixar CSV de exemplo",
        (ROOT / "data/inventario-exemplo.csv").read_bytes(),
        "inventario-exemplo.csv",
        "text/csv",
    )
    editor = st.data_editor(
        pd.DataFrame(assets, columns=FIELDS),
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="inventory_editor",
        column_config={
            "tipo": st.column_config.SelectboxColumn(options=TYPES, required=True),
            "zona": st.column_config.SelectboxColumn(options=ZONES, required=True),
            **{
                field: st.column_config.SelectboxColumn(options=STATES, required=True)
                for field in ["exposto_internet", "mfa", "atualizado", "backup_testado"]
            },
        },
    )
    if st.button("Salvar alterações do inventário", type="primary"):
        try:
            st.session_state.assets = normalize_inventory(editor.to_dict(orient="records"))
            st.success("Inventário validado. O plano usará estas informações.")
        except ValueError as error:
            st.error(str(error))
    st.caption(
        "IP é opcional para serviços em nuvem. Portas são números separados por vírgula. Cada ativo precisa de um ID único."
    )

elif page == "Laboratório de redes":
    st.title("Entenda endereços e limites de acesso.")
    st.caption("Os cálculos e a política abaixo são executados em memória. Não há conexão com equipamentos.")
    left, right = st.columns(2)
    with left:
        with st.container(border=True):
            st.subheader("Calculadora de sub-rede")
            cidr = st.text_input("Rede ou endereço com prefixo", "192.168.10.0/24", max_chars=80)
            try:
                info = subnet_info(cidr)
                st.dataframe(
                    pd.DataFrame([{"campo": key, "valor": str(value)} for key, value in info.items()]),
                    hide_index=True,
                    width="stretch",
                )
            except ValueError as error:
                st.warning(str(error))
            st.caption(
                "O prefixo define a parte de rede. Um endereço com bits de host é normalizado para a rede correspondente. /31 e /32 têm tratamento próprio no IPv4."
            )
    with right:
        with st.container(border=True):
            st.subheader("Redes distintas podem se sobrepor")
            a = st.text_input("Rede interna", "192.168.10.0/24", max_chars=80)
            b = st.text_input("Rede de visitantes", "192.168.20.0/24", max_chars=80)
            try:
                conflicts = overlap_pairs({"Interna": a, "Visitantes": b})
                if conflicts:
                    st.warning("As redes se sobrepõem. Revise o plano de endereçamento.")
                else:
                    st.success(
                        "Os endereços não se sobrepõem. O isolamento ainda depende das regras de acesso e de testes."
                    )
            except ValueError as error:
                st.warning(str(error))
            st.info(
                "Criar uma VLAN organiza uma rede lógica; o controle de tráfego entre redes exige configuração e validação próprias."
            )
    st.subheader("Simule uma regra de acesso")
    columns = st.columns(3)
    origin = columns[0].selectbox("Origem", POLICY_ZONES, index=3)
    destination = columns[1].selectbox("Destino", POLICY_ZONES, index=2)
    port = columns[2].number_input("Porta TCP do exercício", min_value=1, max_value=65535, value=443)
    decision = policy_decision(origin, destination, int(port))
    if decision["decisao"] == "Bloquear":
        st.warning(f"{decision['decisao']}: {decision['motivo']}")
    else:
        st.success(f"{decision['decisao']}: {decision['motivo']}")
    st.caption(
        "Política didática com negação padrão. Não representa todos os fluxos de uma empresa: DNS, DHCP, atualizações, IPv6 e retorno de conexões exigem planejamento adicional."
    )

elif page == "Investigar logs":
    st.title("Investigue um relato, evento por evento.")
    st.write(
        "Um log registra o que um sistema informou. Aqui você monta a sequência, compara hipóteses e identifica o que precisa confirmar. Comece pelo caso fictício de duas transferências não reconhecidas."
    )
    case = st.selectbox(
        "Caso de investigação", ["Fraude financeira fictícia", "Caso benigno fictício", "Arquivo CSV ou JSONL"]
    )
    uploaded_case = (
        st.file_uploader(
            "Eventos CSV ou JSONL no contrato do exemplo · até 2 MB", type=["csv", "jsonl"], key="case_file"
        )
        if case == "Arquivo CSV ou JSONL"
        else None
    )
    file = "caso-financeiro-ficticio.csv" if case == "Fraude financeira fictícia" else "caso-benigno-ficticio.csv"
    contents = uploaded_case.getvalue() if uploaded_case is not None else (ROOT / "data" / file).read_bytes()
    file_format = "jsonl" if uploaded_case is not None and uploaded_case.name.lower().endswith(".jsonl") else "csv"
    if case == "Arquivo CSV ou JSONL" and uploaded_case is None:
        st.info("Envie seu arquivo. Enquanto isso, o caso benigno fictício continua visível como exemplo do formato.")
    st.download_button(
        "Baixar eventos do caso",
        contents,
        f"netguard-eventos.{file_format}",
        "application/x-ndjson" if file_format == "jsonl" else "text/csv",
    )
    left, right = st.columns([1, 1.4])
    limit = left.number_input(
        "Limiar de triagem por transferência (R$)",
        min_value=1,
        max_value=1000000000,
        value=15000,
        step=1000,
        key="investigation_threshold",
    )
    compatible = right.checkbox(
        "IDs de sessão compatíveis entre as fontes",
        value=case != "Arquivo CSV ou JSONL",
        key=f"session_namespace_{case}",
        help="Os sistemas fictícios compartilham os IDs por premissa do caso. Em arquivos próprios, confirme a origem e o namespace antes de correlacionar.",
    )
    try:
        investigation = investigate(contents, int(limit), compatible, file_format)
        values = st.columns(4)
        values[0].metric("Eventos no recorte", len(investigation["events"]))
        values[1].metric("Sinais para investigar", len(investigation["signals"]))
        values[2].metric("Transferências registradas", investigation["transfer_count"])
        money = format_brl(investigation["transfer_total_centavos"])
        values[3].metric("Valor informado no arquivo", money)
        st.caption(
            "Valores são registros do arquivo. Eles não confirmam liquidação bancária ou prejuízo. Todos os casos fornecidos são fictícios."
        )
        if investigation["transfers_without_amount"]:
            st.warning(
                f"{investigation['transfers_without_amount']} transferência(s) não informam valor; não entram na soma."
            )
        if investigation["signals_omitted"]:
            st.warning(
                f"{investigation['signal_count']} sinais no recorte; os primeiros 1.000 são exibidos. {investigation['signals_omitted']} foram omitidos da apresentação. Eventos e total financeiro permanecem completos."
            )
        intro, timeline, signals_tab, notebook, authentication = st.tabs(
            [
                "Entenda o caso",
                "Linha do tempo",
                "Sinais e hipóteses",
                "Caderno da investigação",
                "Triagem de autenticação",
            ]
        )
        with intro:
            st.subheader("Nunca leu um log? Comece por um registro.")
            if investigation["events"]:
                event_id = st.selectbox(
                    "Evento que deseja entender", [event["event_id"] for event in investigation["events"]]
                )
                event = next(event for event in investigation["events"] if event["event_id"] == event_id)
                st.info(explain_event(event))
                field = st.selectbox(
                    "Qual campo quer entender?",
                    list(FIELD_GUIDE),
                    format_func=lambda name: f"{name} · {FIELD_GUIDE[name][0]}",
                )
                st.write(f"**Valor do campo:** {event[field] or 'Não informado'}")
                st.write(FIELD_GUIDE[field][1])
            st.subheader("O que precisamos responder?")
            st.write(
                "Na loja fictícia, a equipe relata operações não reconhecidas. Há falhas de acesso, um login, alteração de MFA e registros financeiros. Uma conexão em RDP aparece no mesmo recorte, mas não estabelece a porta de entrada da fraude."
            )
            if case == "Caso benigno fictício":
                st.info(
                    "Neste caso, a pessoa esqueceu a senha e depois fez uma operação pequena e autorizada. A regra ainda pode gerar um sinal: esse é o exercício de falso positivo."
                )
            st.markdown(
                "1. Observe a sequência e anote os IDs.\n2. Leia cada sinal e sua explicação alternativa.\n3. Registre o que falta confirmar.\n4. Proponha uma contenção vinculada à evidência."
            )
            with st.expander("Guia completo para começar"):
                st.markdown((ROOT / "docs/INVESTIGACAO_DE_LOGS.md").read_text())
        with timeline:
            st.subheader("Linha do tempo em UTC")
            frame = pd.DataFrame(investigation["events"])
            if not frame.empty:
                sources = st.multiselect(
                    "Fontes que deseja acompanhar",
                    sorted(frame["origem"].unique()),
                    default=sorted(frame["origem"].unique()),
                )
                selected = frame[frame["origem"].isin(sources)]
                graph = (
                    alt.Chart(selected)
                    .mark_circle(size=130, opacity=0.9)
                    .encode(
                        x=alt.X(
                            "timestamp:T",
                            title="Horário UTC",
                            scale=alt.Scale(type="utc"),
                            axis=alt.Axis(format="%d/%m %H:%M", labelAngle=-25),
                        ),
                        y=alt.Y("origem:N", title=None),
                        color=alt.Color(
                            "resultado:N",
                            scale=alt.Scale(
                                domain=["sucesso", "falha", "negado", "informativo"],
                                range=["#008C4C", "#C05B48", "#B28225", "#2f6b3f"],
                            ),
                        ),
                        tooltip=["event_id", "timestamp", "acao", "usuario", "sessao", "recurso"],
                    )
                    .properties(height=245)
                )
                st.altair_chart(graph, width="stretch")
                st.dataframe(selected.drop(columns="valor_centavos"), hide_index=True, width="stretch")
                st.download_button(
                    "Exportar linha do tempo CSV",
                    safe_csv(
                        selected.to_dict(orient="records"),
                        [
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
                        ],
                    ),
                    "netguard-linha-do-tempo.csv",
                    "text/csv",
                )
                st.caption(
                    "IDs, fonte, conta e sessão continuam visíveis. Estar perto no tempo não comprova relação de causa."
                )
        with signals_tab:
            st.subheader("Uma observação pode sustentar mais de uma explicação.")
            if not investigation["signals"]:
                st.info(
                    "Nenhum sinal da regra apareceu. O arquivo pode estar incompleto ou o comportamento fora da cobertura do exercício."
                )
            for number, item in enumerate(investigation["signals"], 1):
                with st.expander(
                    f"{number:02} · {item['sinal']} · {', '.join(item['event_ids'])}", expanded=number == 1
                ):
                    st.markdown("**O que está registrado**")
                    st.write(item["observacao"])
                    st.markdown("**Hipótese para investigar**")
                    st.write(item["hipotese"])
                    st.markdown("**Uma explicação alternativa**")
                    st.write(item["explicacao_alternativa"])
                    st.markdown("**Próxima verificação**")
                    st.write(item["proxima_verificacao"])
                    if item["evidencias_omitidas"]:
                        st.warning(
                            f"{item['evidencias_omitidas']} evidências anteriores foram omitidas deste cartão; consulte a linha do tempo completa."
                        )
            st.caption(
                "As regras são explícitas e não usam IA. Elas ajudam a selecionar perguntas; não determinam autoria ou invasão."
            )
        with notebook:
            st.subheader("Guarde uma investigação que outra pessoa consiga conferir.")
            prefix = investigation["sha256"][:16]
            fields = {
                "observacoes": "Observações e IDs dos eventos",
                "hipoteses": "Hipóteses e explicações alternativas",
                "pendencias": "Perguntas e evidências que faltam",
                "contencao": "Contenção proposta, responsável e validação",
            }
            with st.expander("Restaurar caderno exportado"):
                notebook_file = st.file_uploader(
                    "Caderno JSON do mesmo arquivo de eventos · até 2 MB", type="json", key="notebook_restore_file"
                )
                st.button(
                    "Restaurar caderno",
                    disabled=notebook_file is None,
                    on_click=import_investigation_notebook,
                    args=(prefix, investigation, case),
                )
                if st.session_state.get("notebook_restore_error"):
                    st.error(st.session_state.notebook_restore_error)
            investigation_notes = {}
            stored_notes = st.session_state.get("investigation_notebooks", {}).get(prefix, {})
            for key, label in fields.items():
                investigation_notes[key] = st.text_area(
                    label,
                    value=stored_notes.get(key, ""),
                    max_chars=3000,
                    key=f"investigation_{prefix}_{key}",
                    height=100,
                    on_change=save_investigation_note,
                    args=(prefix, key),
                )
            st.download_button(
                "Exportar caderno JSON",
                encode_notebook(investigation, investigation_notes, case),
                "netguard-caderno-investigacao.json",
                "application/json",
            )
            st.download_button(
                "Exportar relatório da investigação",
                investigation_report(investigation, investigation_notes, case),
                "netguard-investigacao.html",
                "text/html",
            )
            st.caption(
                "O caderno fica na sessão até ser exportado. O hash identifica os bytes recebidos e não comprova autenticidade do arquivo original."
            )
            st.code(investigation["sha256"], language="text")
        with authentication:
            st.subheader("Experimente uma regra menor antes de correlacionar tudo.")
            example = (ROOT / "data/log-autenticacao-exemplo.csv").read_bytes()
            st.download_button(
                "Baixar log de autenticação fictício", example, "log-autenticacao-exemplo.csv", "text/csv"
            )
            upload = st.file_uploader("Log CSV · timestamp, usuario, ip, resultado", type="csv", key="auth_file")
            a, b = st.columns(2)
            threshold = a.slider("Falhas para sinalizar", 2, 20, 5)
            minutes = b.slider("Janela em minutos", 1, 60, 10)
            found = analyze_auth_csv(upload.getvalue() if upload is not None else example, threshold, minutes)
            if found:
                st.dataframe(pd.DataFrame(found), hide_index=True, width="stretch")
            else:
                st.info("Nenhum sinal nesse recorte e nessa regra.")
    except ValueError as error:
        st.error(str(error))

elif page == "Plano e relatório":
    st.title("Transforme o diagnóstico em próximas ações.")
    if summary:
        plan = action_plan(answers, notes, assets)
        st.dataframe(pd.DataFrame(plan), hide_index=True, width="stretch")
        st.caption(
            "Prioridade e prazo são heurísticas de planejamento. Revise impacto, dependências e responsáveis antes de alterar um serviço."
        )
        left, middle, right = st.columns(3)
        try:
            left.download_button(
                "Salvar avaliação JSON",
                encode_snapshot(st.session_state.company, answers, notes, assets),
                "netguard-avaliacao.json",
                "application/json",
            )
            middle.download_button(
                "Baixar plano CSV",
                safe_csv(plan, ["prioridade", "origem", "item", "motivo", "acao", "prazo_dias"]),
                "netguard-plano.csv",
                "text/csv",
            )
            right.download_button(
                "Baixar relatório HTML",
                html_report(st.session_state.company, answers, notes, assets),
                "netguard-relatorio.html",
                "text/html",
            )
        except ValueError as error:
            st.error(str(error))
        st.caption(
            "O relatório HTML abre no navegador e pode ser impresso. O JSON permite restaurar as respostas e o inventário em outra sessão."
        )
    with st.expander("Entenda a pontuação e seus limites"):
        st.markdown((ROOT / "docs/METODOLOGIA.md").read_text())

else:
    st.title("Retome redes e conheça a rotina de segurança.")
    st.markdown((ROOT / "docs/TRILHA_DE_ESTUDO.md").read_text())

st.divider()
st.caption(
    "NetGuard Lab · Projeto educacional de Bruno Nunes. As ações propostas dependem das informações fornecidas. Catálogo próprio inspirado em NIST CSF 2.0 e CISA; sem afiliação ou certificação."
)
