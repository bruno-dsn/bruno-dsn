"""Snapshots validados e relatórios com escape de texto e de células CSV."""

from datetime import datetime, timezone
import csv
import html
import io
import json

from .assessment import assess
from .inventory import FIELDS, MAX_BYTES, analyze_inventory, normalize_inventory


def safe_csv(rows: list[dict], fields: list[str] | tuple[str, ...]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        sanitized = {}
        for field in fields:
            value = row.get(field, "")
            if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                value = "'" + value
            sanitized[field] = value
        writer.writerow(sanitized)
    return stream.getvalue().encode("utf-8-sig")


def snapshot(company: str, answers: dict, notes: dict, assets: list) -> dict:
    if not isinstance(company, str) or not company.strip() or len(company) > 100:
        raise ValueError("Informe um nome de cenário de até 100 caracteres.")
    assess(answers, notes)
    return {"schema_version": 1, "cenario": company.strip(), "answers": answers, "notes": notes, "assets": normalize_inventory(assets)}


def encode_snapshot(company: str, answers: dict, notes: dict, assets: list) -> bytes:
    return json.dumps(snapshot(company, answers, notes, assets), ensure_ascii=False, indent=2).encode("utf-8")


def decode_snapshot(data: bytes) -> dict:
    if len(data) > MAX_BYTES:
        raise ValueError("A avaliação deve ter até 2 MB.")
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("O JSON contém uma chave repetida.")
            result[key] = value
        return result
    try:
        value = json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as error:
        raise ValueError("Não foi possível ler o JSON da avaliação.") from error
    if not isinstance(value, dict) or set(value) != {"schema_version", "cenario", "answers", "notes", "assets"} or type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise ValueError("Use uma avaliação exportada pelo NetGuard Lab versão 1.")
    return snapshot(value["cenario"], value["answers"], value["notes"], value["assets"])


def action_plan(answers: dict, notes: dict, assets: list) -> list[dict]:
    rows = assess(answers, notes)["actions"] + analyze_inventory(assets)
    return sorted(rows, key=lambda row: (-row["peso"], row["prazo_dias"], row["item"]))


def html_report(company: str, answers: dict, notes: dict, assets: list) -> bytes:
    value = snapshot(company, answers, notes, assets)
    assessment = assess(answers, notes)
    plan = action_plan(answers, notes, assets)
    def table(rows, fields):
        header = "".join(f"<th>{html.escape(key)}</th>" for key in fields)
        body = "".join("<tr>" + "".join(f"<td>{html.escape(str(row.get(key, '')))}</td>" for key in fields) + "</tr>" for row in rows)
        return f"<table><thead><tr>{header}</tr></thead><tbody>{body}</tbody></table>"
    score = "Sem controles aplicáveis" if assessment["score"] is None else f"{assessment['score']:.1f}%"
    rendered = f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NetGuard Lab · Relatório</title>
<style>body{{font:15px/1.55 system-ui,sans-serif;color:#192c3d;background:#f5f7fa;margin:0}}main{{max-width:1100px;margin:auto;padding:36px}}header{{border-left:5px solid #067a70;padding:16px 22px;background:white}}h1{{margin:0}}h2{{margin-top:32px}}p{{max-width:1000px}}table{{border-collapse:collapse;background:white;width:100%;font-size:12px}}td,th{{border:1px solid #d8e1e8;text-align:left;padding:9px;vertical-align:top;overflow-wrap:anywhere}}th{{background:#eaf3f2}}@media print{{body{{background:white}}main{{padding:0}}thead{{display:table-header-group}}tr{{break-inside:avoid}}}}button{{padding:10px;border:1px solid #adc9c5;background:white}}@media print{{button{{display:none}}}}</style>
<main><header><h1>NetGuard Lab</h1><p>{html.escape(value['cenario'])} · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p></header>
<h2>Resumo das declarações</h2><p>Atendimento declarado: {score}. Controles aplicáveis: {assessment['applicable']}; implementados: {assessment['implemented']}; desconhecidos: {assessment['unknown']}; notas registradas: {assessment['evidence_count']}.</p>
<p>Este relatório organiza respostas e dados fornecidos. Não houve varredura, verificação automática da rede, auditoria de conformidade ou cálculo de probabilidade de ataque. Revise as prioridades com os responsáveis pelos serviços.</p>
<h2>Plano de ação</h2>{table(plan, ['prioridade','origem','item','motivo','acao','prazo_dias'])}
<p>Os prazos são sugestões de planejamento a partir da avaliação; não representam datas contratuais ou obrigação normativa. Combine responsáveis e datas com a equipe.</p>
<h2>Controles e evidências registradas</h2>{table(assessment['controls'], ['area','controle','estado','nota'])}
<h2>Inventário informado</h2>{table(value['assets'], FIELDS)}
<h2>Método</h2><p>Pesos próprios de 2 a 5. Implementado vale 1, parcial vale 0,5, ausente e desconhecido valem 0. Não aplicável exige justificativa e sai do denominador. O percentual é a soma ponderada dividida pelo peso aplicável. Notas não foram verificadas. A exposição declarada de certos serviços recebe prioridade adicional no inventário; as regras são heurísticas educacionais.</p>
<p>Referências: <a href="https://www.nist.gov/publications/nist-cybersecurity-framework-20-small-business-quick-start-guide">NIST SP 1300</a> e <a href="https://www.cisa.gov/secure-our-world">CISA Secure Our World</a>. O catálogo e a pontuação são próprios; não são uma avaliação oficial do NIST ou da CISA.</p></main></html>'''
    return rendered.encode("utf-8")
