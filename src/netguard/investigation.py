"""Investigação guiada a partir de eventos fornecidos, sem acesso a sistemas."""

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from itertools import islice
import csv
import hashlib
import io
import ipaddress
import json
import re

FIELDS = ("event_id", "timestamp", "origem", "usuario", "ip", "sessao", "acao", "resultado", "recurso", "valor_brl")
SOURCES = ("autenticacao", "identidade", "financeiro", "rede")
OUTCOMES = ("sucesso", "falha", "negado", "informativo")
MAX_SIGNALS = 1000
MAX_EVIDENCE = 50
TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})\Z")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Chave JSON repetida: {key}.")
        result[key] = value
    return result


def parse_events(data: bytes, file_format: str = "csv") -> dict:
    """Normalize CSV ou JSONL; preserve os bytes originais e valide cada campo."""
    if not isinstance(data, bytes) or not data or len(data) > 2 * 1024 * 1024:
        raise ValueError("Use um arquivo de até 2 MB.")
    if file_format not in ("csv", "jsonl"):
        raise ValueError("Escolha CSV ou JSONL.")
    try:
        text = data.decode("utf-8-sig")
        if file_format == "csv":
            reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
            if (
                reader.fieldnames is None
                or len(reader.fieldnames) != len(FIELDS)
                or set(reader.fieldnames) != set(FIELDS)
            ):
                raise ValueError("Use as colunas exatas do caso de exemplo.")
        else:
            reader = (json.loads(line, object_pairs_hook=unique_object) for line in text.splitlines() if line.strip())
        events, ids = [], set()
        for number, row in enumerate(reader, 1):
            if number > 10000 or not isinstance(row, dict) or set(row) != set(FIELDS):
                raise ValueError("Arquivo fora do contrato ou acima de 10.000 eventos.")
            if any(not isinstance(value, str) or len(value) > 200 for value in row.values()):
                raise ValueError(f"Linha {number}: campo inválido ou acima de 200 caracteres.")
            event = {field: value.strip() for field, value in row.items()}
            if not event["event_id"] or event["event_id"] in ids:
                raise ValueError(f"Linha {number}: cada evento precisa de um ID único.")
            ids.add(event["event_id"])
            if not TIMESTAMP.fullmatch(event["timestamp"]):
                raise ValueError(
                    f"Linha {number}: use data e hora ISO 8601 com fuso explícito, como 2026-10-08T12:00:00Z."
                )
            if event["timestamp"][-1] != "Z" and (
                int(event["timestamp"][-5:-3]) > 23 or int(event["timestamp"][-2:]) > 59
            ):
                raise ValueError(f"Linha {number}: fuso inválido.")
            instant = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
            event["timestamp"] = instant.astimezone(timezone.utc).isoformat()
            if event["origem"] not in SOURCES or event["resultado"] not in OUTCOMES or not event["acao"]:
                raise ValueError(f"Linha {number}: origem, resultado ou ação fora do contrato.")
            if event["ip"]:
                event["ip"] = str(ipaddress.ip_address(event["ip"]))
            amount = None
            if event["valor_brl"]:
                if not re.fullmatch(r"[0-9]+(?:\.[0-9]{1,2})?", event["valor_brl"]):
                    raise ValueError(f"Linha {number}: use valor_brl como 15000.00, com até duas casas decimais.")
                amount = Decimal(event["valor_brl"])
                if (
                    not amount.is_finite()
                    or amount < 0
                    or amount > Decimal("1000000000000")
                    or amount != amount.quantize(Decimal("0.01"))
                ):
                    raise ValueError(
                        f"Linha {number}: valor_brl deve ser finito, não negativo e ter até duas casas decimais."
                    )
            event["valor_centavos"] = int(amount * 100) if amount is not None else None
            events.append(event)
        if not events:
            raise ValueError("O arquivo precisa conter pelo menos um evento.")
    except (
        UnicodeDecodeError,
        csv.Error,
        json.JSONDecodeError,
        InvalidOperation,
        TypeError,
        OverflowError,
        RecursionError,
    ) as error:
        raise ValueError("Use CSV ou JSONL em UTF-8, horário com fuso e valores em reais como 15000.00.") from error
    events.sort(key=lambda event: (datetime.fromisoformat(event["timestamp"]), event["event_id"]))
    return {"events": events, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def investigate(
    data: bytes, transfer_threshold_brl: int = 15000, shared_session_namespace: bool = False, file_format: str = "csv"
) -> dict:
    """Produza sinais e hipóteses vinculados aos eventos exatos que os sustentam."""
    if type(transfer_threshold_brl) is not int or not 1 <= transfer_threshold_brl <= 1000000000:
        raise ValueError("Informe um limiar inteiro de 1 a 1 bilhão de reais.")
    if type(shared_session_namespace) is not bool:
        raise ValueError("Informe se os IDs de sessão são compatíveis entre as fontes.")
    parsed = parse_events(data, file_format)
    events = parsed["events"]
    signals, windows, seen_ips, sessions = [], {}, defaultdict(dict), defaultdict(list)
    signal_count = 0
    for event in events:
        if shared_session_namespace and event["sessao"] and event["usuario"]:
            sessions[(event["usuario"], event["sessao"])].append(event)

    def signal(label, evidence, hypothesis, alternative, next_step, omitted=0):
        nonlocal signal_count
        signal_count += 1
        if len(signals) >= MAX_SIGNALS:
            return
        omitted += max(0, len(evidence) - MAX_EVIDENCE)
        evidence = evidence[-MAX_EVIDENCE:]
        signals.append(
            {
                "sinal": label,
                "event_ids": [event["event_id"] for event in evidence],
                "evidencias_omitidas": omitted,
                "observacao": "; ".join(
                    f"{event['timestamp']} · {event['acao']} · {event['resultado']}" for event in evidence
                ),
                "hipotese": hypothesis,
                "explicacao_alternativa": alternative,
                "proxima_verificacao": next_step,
            }
        )

    for event in events:
        instant = datetime.fromisoformat(event["timestamp"])
        if event["origem"] == "autenticacao" and event["acao"] == "login" and event["usuario"] and event["ip"]:
            key = (event["usuario"], event["ip"])
            queue = windows.setdefault(key, deque())
            while queue and instant - datetime.fromisoformat(queue[0]["timestamp"]) > timedelta(minutes=10):
                queue.popleft()
            if event["resultado"] == "falha":
                queue.append(event)
            elif event["resultado"] == "sucesso":
                if len(queue) >= 5:
                    evidence = list(reversed(list(islice(reversed(queue), MAX_EVIDENCE - 1)))) + [event]
                    signal(
                        "Login após falhas concentradas",
                        evidence,
                        "Um acesso precisa de investigação após pelo menos cinco falhas em dez minutos.",
                        "A pessoa pode ter esquecido a senha ou usado um cliente mal configurado.",
                        "Confirmar a legitimidade do acesso por um canal conhecido e conferir os registros do provedor.",
                        max(0, len(queue) - MAX_EVIDENCE + 1),
                    )
                if seen_ips[event["usuario"]] and event["ip"] not in seen_ips[event["usuario"]]:
                    reference = next(iter(seen_ips[event["usuario"]].values()))
                    signal(
                        "Origem não vista antes neste arquivo",
                        [reference, event],
                        "A conta foi usada a partir de um IP diferente dos sucessos anteriores presentes no recorte.",
                        "VPN, provedor móvel ou trabalho remoto podem explicar a mudança. O recorte pode estar incompleto.",
                        "Revisar contexto, dispositivo, MFA e a extensão do histórico disponível.",
                    )
                seen_ips[event["usuario"]].setdefault(event["ip"], event)
        if event["origem"] == "identidade" and event["acao"] == "mfa_desativado" and event["resultado"] == "sucesso":
            signal(
                "MFA desativado",
                [event],
                "Uma proteção da conta foi alterada antes ou durante o período investigado.",
                "Pode ter sido uma recuperação de conta aprovada pelo suporte.",
                "Conferir autorização, responsável, dispositivo e registro original da alteração.",
            )
        if (
            event["origem"] == "financeiro"
            and event["acao"] == "transferencia"
            and event["resultado"] == "sucesso"
            and event["valor_centavos"] is not None
            and event["valor_centavos"] >= transfer_threshold_brl * 100
        ):
            signal(
                "Transferência acima do limiar escolhido",
                [event],
                "A operação ultrapassa o limiar de triagem escolhido para este exercício.",
                "Uma transferência alta pode fazer parte da rotina e ter aprovação legítima.",
                "Conferir favorecido, aprovação, conciliação e confirmação com a equipe financeira.",
            )

    for (_, session), group in sessions.items():
        changes = deque()
        for event in group:
            instant = datetime.fromisoformat(event["timestamp"])
            while changes and instant - datetime.fromisoformat(changes[0]["timestamp"]) > timedelta(minutes=30):
                changes.popleft()
            if event["resultado"] == "sucesso" and (event["origem"], event["acao"]) in {
                ("identidade", "mfa_desativado"),
                ("financeiro", "alteracao_favorecido"),
            }:
                changes.append(event)
            if (
                changes
                and event["origem"] == "financeiro"
                and event["acao"] == "transferencia"
                and event["resultado"] == "sucesso"
            ):
                # O custo por sinal fica limitado. A fila conserva a contagem do recorte.
                related = list(reversed(list(islice(reversed(changes), MAX_EVIDENCE - 1))))
                omitted = max(0, len(changes) - len(related))
                signal(
                    "Alteração e transferência na mesma sessão",
                    related + [event],
                    f"Os registros compartilham a sessão {session} e ocorreram em até trinta minutos. Isso sustenta a investigação conjunta desses eventos.",
                    "A própria equipe pode ter feito a alteração e a transferência com autorização.",
                    "Confirmar como cada sistema define o ID de sessão, consultar aprovação e preservar os registros originais. IDs iguais de sistemas sem namespace compartilhado não provam vínculo.",
                    omitted,
                )
    transfers = [
        event
        for event in events
        if event["origem"] == "financeiro" and event["acao"] == "transferencia" and event["resultado"] == "sucesso"
    ]
    return {
        **parsed,
        "signals": signals,
        "signal_count": signal_count,
        "signals_omitted": max(0, signal_count - MAX_SIGNALS),
        "transfer_count": len(transfers),
        "transfer_total_centavos": sum(event["valor_centavos"] or 0 for event in transfers),
        "transfers_without_amount": sum(event["valor_centavos"] is None for event in transfers),
        "threshold_brl": transfer_threshold_brl,
        "shared_session_namespace": shared_session_namespace,
    }


def format_brl(cents: int) -> str:
    reais, centavos = divmod(cents, 100)
    return f"R$ {reais:,}".replace(",", ".") + f",{centavos:02}"
