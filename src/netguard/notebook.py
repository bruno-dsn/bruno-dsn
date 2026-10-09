"""Caderno portável vinculado aos bytes do recorte, com relatório escapado."""

import html
import json

from netguard.investigation import unique_object

NOTE_FIELDS = ("observacoes", "hipoteses", "pendencias", "contencao")
NOTE_LABELS = ("Observações e IDs", "Hipóteses e alternativas", "Evidências pendentes", "Contenção proposta")
KEYS = {
    "schema_version",
    "caso",
    "arquivo_sha256",
    "bytes",
    "ids_eventos",
    "limiar_transferencia_brl",
    "ids_sessao_compativeis",
    "notas",
}


def decode_notebook(data: bytes, investigation: dict) -> dict:
    if not isinstance(data, bytes) or not data or len(data) > 2 * 1024 * 1024:
        raise ValueError("Use um caderno JSON de até 2 MB.")
    try:
        value = json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as error:
        raise ValueError("O caderno precisa ser um JSON válido em UTF-8.") from error
    if (
        not isinstance(value, dict)
        or set(value) != KEYS
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
    ):
        raise ValueError("Formato ou versão de caderno não reconhecidos.")
    if (
        value["arquivo_sha256"] != investigation["sha256"]
        or type(value["bytes"]) is not int
        or value["bytes"] != investigation["bytes"]
    ):
        raise ValueError(
            "Este caderno pertence a outros bytes. Abra primeiro o arquivo original usado na investigação."
        )
    if value["ids_eventos"] != [event["event_id"] for event in investigation["events"]]:
        raise ValueError("Os IDs do caderno não correspondem à linha do tempo atual.")
    if not isinstance(value["caso"], str) or not 1 <= len(value["caso"]) <= 100:
        raise ValueError("Informe um nome de caso com até 100 caracteres.")
    if (
        type(value["limiar_transferencia_brl"]) is not int
        or not 1 <= value["limiar_transferencia_brl"] <= 1000000000
        or type(value["ids_sessao_compativeis"]) is not bool
    ):
        raise ValueError("Parâmetros de investigação inválidos.")
    if (
        not isinstance(value["notas"], dict)
        or set(value["notas"]) != set(NOTE_FIELDS)
        or any(not isinstance(note, str) or len(note) > 3000 for note in value["notas"].values())
    ):
        raise ValueError("O caderno precisa das quatro notas, cada uma com até 3.000 caracteres.")
    return value


def encode_notebook(investigation: dict, notes: dict, case: str) -> bytes:
    value = {
        "schema_version": 1,
        "caso": case,
        "arquivo_sha256": investigation["sha256"],
        "bytes": investigation["bytes"],
        "ids_eventos": [event["event_id"] for event in investigation["events"]],
        "limiar_transferencia_brl": investigation["threshold_brl"],
        "ids_sessao_compativeis": investigation["shared_session_namespace"],
        "notas": notes,
    }
    data = json.dumps(value, ensure_ascii=False, indent=2).encode()
    decode_notebook(data, investigation)
    return data


def investigation_report(investigation: dict, notes: dict, case: str) -> bytes:
    decode_notebook(encode_notebook(investigation, notes, case), investigation)

    def escape(value):
        return html.escape(str(value), quote=True)

    notes_html = "".join(
        f"<h2>{label}</h2><p class='note'>{escape(notes[field]) or 'Sem anotação.'}</p>"
        for field, label in zip(NOTE_FIELDS, NOTE_LABELS, strict=True)
    )
    rows = "".join(
        "<tr>"
        + "".join(
            f"<td>{escape(event[field])}</td>"
            for field in ("event_id", "timestamp", "origem", "usuario", "acao", "resultado")
        )
        + "</tr>"
        for event in investigation["events"]
    )
    signals = "".join(
        f"<article><h3>{escape(item['sinal'])}</h3><p>IDs: {escape(', '.join(item['event_ids']))} · evidências omitidas na apresentação: {item['evidencias_omitidas']}</p><p><b>Observação:</b> {escape(item['observacao'])}</p><p><b>Hipótese:</b> {escape(item['hipotese'])}</p><p><b>Alternativa:</b> {escape(item['explicacao_alternativa'])}</p><p><b>Verificar:</b> {escape(item['proxima_verificacao'])}</p></article>"
        for item in investigation["signals"]
    )
    return f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>NetGuard Lab · Caderno</title><style>body{{font:16px/1.6 system-ui;color:#1b231d;background:#fffdf6;max-width:1000px;margin:40px auto;padding:0 24px}}h1,h2{{color:#2f6b3f}}article{{border:1px solid #d1c09f;padding:16px;margin:16px 0}}table{{border-collapse:collapse;width:100%;font-size:12px}}td,th{{border:1px solid #d1c09f;text-align:left;padding:8px;overflow-wrap:anywhere}}.note{{white-space:pre-wrap}}code{{overflow-wrap:anywhere}}@media print{{body{{margin:0;padding:0}}article{{break-inside:avoid}}thead{{display:table-header-group}}}}</style><h1>NetGuard Lab · {escape(case)}</h1><p>Recorte recebido: {investigation["bytes"]} bytes. SHA-256: <code>{escape(investigation["sha256"])}</code>.</p><p>O hash identifica os bytes, não comprova origem ou autenticidade. {len(investigation["events"])} eventos; {investigation["signal_count"]} sinais pelas regras; {investigation["signals_omitted"]} sinais omitidos da apresentação. Limiar: R$ {investigation["threshold_brl"]}. Sessões compatíveis entre fontes: {"sim" if investigation["shared_session_namespace"] else "não"}.</p><p>Logs e sinais não confirmam autoria, invasão ou prejuízo. Consulte registros originais, aprovações e a equipe responsável. Este relatório contém dados e anotações do recorte: revise antes de compartilhar.</p>{notes_html}<h2>Sinais e hipóteses</h2>{signals or "<p>Nenhum sinal nas regras deste exercício.</p>"}<h2>Linha do tempo em UTC</h2><table><thead><tr><th>ID</th><th>Horário</th><th>Fonte</th><th>Conta</th><th>Ação</th><th>Resultado</th></tr></thead><tbody>{rows}</tbody></table></html>""".encode()
