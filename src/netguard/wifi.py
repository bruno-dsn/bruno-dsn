"""Revisão declarada de Wi-Fi, sem conectar ou alterar equipamentos."""

import html
import json
from pathlib import Path

from netguard.investigation import unique_object

CATALOG = json.loads((Path(__file__).resolve().parents[2] / "data/wifi-checklist.json").read_text(encoding="utf-8"))
CONTROLS = CATALOG["controls"]
STATUSES = CATALOG["statuses"]
KEYS = {"schema_version", "kind", "network_name", "answers", "notes"}
IDS = {control["id"] for control in CONTROLS}


def new_review() -> dict:
    return {"schema_version": 1, "kind": "netguard-wifi-review", "network_name": "Minha rede", "answers": {key: "unknown" for key in IDS}, "notes": {key: "" for key in IDS}}


def validate_review(value: dict) -> dict:
    if (not isinstance(value, dict) or set(value) != KEYS or type(value["schema_version"]) is not int or value["schema_version"] != 1 or value["kind"] != "netguard-wifi-review"):
        raise ValueError("Use uma revisão Wi-Fi exportada pelo NetGuard, esquema 1.")
    name = value["network_name"]
    if not isinstance(name, str) or not name.strip() or len(name.encode("utf-16-le")) // 2 > 100:
        raise ValueError("Informe um nome com até 100 caracteres.")
    if any(not isinstance(value[field], dict) or set(value[field]) != IDS for field in ("answers", "notes")):
        raise ValueError("A revisão precisa das seis respostas e notas.")
    for key in IDS:
        status, note = value["answers"][key], value["notes"][key]
        if not isinstance(status, str) or status not in STATUSES or not isinstance(note, str) or len(note.encode("utf-16-le")) // 2 > 1000:
            raise ValueError("Respostas inválidas ou notas acima de 1.000 caracteres.")
        if status in ("checked", "na") and not note.strip():
            raise ValueError("Conferido por mim e Não se aplica exigem evidência ou justificativa.")
    return value


def decode_review(data: bytes) -> dict:
    if not isinstance(data, bytes) or not data or len(data) > 2 * 1024 * 1024:
        raise ValueError("Use uma revisão JSON de até 2 MB.")
    try:
        value = json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as error:
        raise ValueError("A revisão precisa ser um JSON válido em UTF-8.") from error
    return validate_review(value)


def encode_review(value: dict) -> bytes:
    validate_review(value)
    return json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8")


def review_summary(value: dict) -> dict:
    validate_review(value)
    counts = dict.fromkeys(STATUSES, 0)
    tasks = []
    for control in CONTROLS:
        status = value["answers"][control["id"]]
        counts[status] += 1
        if status in ("unknown", "review"):
            tasks.append({**control, "status": status, "action": control["verify"] if status == "unknown" else control["next"]})
    return {"counts": counts, "tasks": tasks}


def review_report(value: dict) -> bytes:
    counts = review_summary(value)["counts"]
    articles = []
    for control in CONTROLS:
        key = control["id"]
        status = value["answers"][key]
        action = control["verify"] if status == "unknown" else control["next"] if status == "review" else "Revisar a evidência periodicamente e após mudanças."
        articles.append(f'<article><h2>{html.escape(control["title"])}</h2><p>Declaração: {html.escape(STATUSES[status])}</p><p class="note">Evidência ou justificativa: {html.escape(value["notes"][key] or "Não registrada.")}</p><p>Como conferir: {html.escape(control["verify"])}</p><p>Próxima ação: {html.escape(action)}</p></article>')
    return f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>NetGuard Lab · Revisão Wi-Fi</title><style>body{{font:16px/1.6 system-ui;color:#1b231d;max-width:900px;margin:40px auto;padding:0 24px}}h1,h2{{color:#2f6b3f}}article{{border:1px solid #d1c09f;padding:18px;margin:14px 0;break-inside:avoid}}.note{{white-space:pre-wrap;overflow-wrap:anywhere}}</style><h1>NetGuard Lab · {html.escape(value["network_name"])}</h1><p>Revisão declarada de Wi-Fi e roteador. O aplicativo não conectou equipamentos nem verificou as respostas. Não é uma nota de segurança.</p><p>{counts["unknown"]} a confirmar · {counts["review"]} com ajuste declarado · {counts["checked"]} conferidos pelo usuário · {counts["na"]} não aplicáveis.</p><p>Revise impacto, permissões e responsáveis antes de mudar configurações. Este arquivo pode conter anotações internas; revise antes de compartilhar.</p>{"".join(articles)}</html>'''.encode("utf-8")
