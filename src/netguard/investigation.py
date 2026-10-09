"""Investigação guiada a partir de eventos fornecidos, sem acesso a sistemas."""

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import csv
import hashlib
import io
import ipaddress

FIELDS = ("event_id", "timestamp", "origem", "usuario", "ip", "sessao", "acao", "resultado", "recurso", "valor_brl")
SOURCES = ("autenticacao", "identidade", "financeiro", "rede")
OUTCOMES = ("sucesso", "falha", "negado", "informativo")


def parse_events(data: bytes) -> dict:
    """Normalize um CSV, preservando IDs e a identificação dos bytes recebidos."""
    if len(data) > 2 * 1024 * 1024:
        raise ValueError("Use um arquivo de até 2 MB.")
    try:
        reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
        if reader.fieldnames is None or len(reader.fieldnames) != len(FIELDS) or set(reader.fieldnames) != set(FIELDS):
            raise ValueError("Use as colunas exatas do caso de exemplo.")
        events, ids = [], set()
        for number, row in enumerate(reader, 1):
            if number > 10000 or set(row) != set(FIELDS):
                raise ValueError("Arquivo fora do contrato ou acima de 10.000 eventos.")
            if any(not isinstance(value, str) or len(value) > 200 for value in row.values()):
                raise ValueError(f"Linha {number}: campo inválido ou acima de 200 caracteres.")
            event = {field: value.strip() for field, value in row.items()}
            if not event["event_id"] or event["event_id"] in ids:
                raise ValueError(f"Linha {number}: cada evento precisa de um ID único.")
            ids.add(event["event_id"])
            instant = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
            if instant.tzinfo is None:
                raise ValueError(f"Linha {number}: informe o fuso no timestamp.")
            event["timestamp"] = instant.astimezone(timezone.utc).isoformat()
            if event["origem"] not in SOURCES or event["resultado"] not in OUTCOMES or not event["acao"]:
                raise ValueError(f"Linha {number}: origem, resultado ou ação fora do contrato.")
            if event["ip"]:
                event["ip"] = str(ipaddress.ip_address(event["ip"]))
            amount = None
            if event["valor_brl"]:
                amount = Decimal(event["valor_brl"])
                if not amount.is_finite() or amount < 0 or amount > Decimal("1000000000000") or amount != amount.quantize(Decimal("0.01")):
                    raise ValueError(f"Linha {number}: valor_brl deve ser finito, não negativo e ter até duas casas decimais.")
            event["valor_centavos"] = int(amount * 100) if amount is not None else None
            events.append(event)
    except (UnicodeDecodeError, csv.Error, InvalidOperation, TypeError) as error:
        raise ValueError("Use CSV UTF-8, horário com fuso e valores em reais como 15000.00.") from error
    events.sort(key=lambda event: (datetime.fromisoformat(event["timestamp"]), event["event_id"]))
    return {"events": events, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def investigate(data: bytes, transfer_threshold_brl: int = 15000, shared_session_namespace: bool = False) -> dict:
    """Produza sinais e hipóteses vinculados aos eventos exatos que os sustentam."""
    if type(transfer_threshold_brl) is not int or not 1 <= transfer_threshold_brl <= 1000000000:
        raise ValueError("Informe um limiar inteiro de 1 a 1 bilhão de reais.")
    if type(shared_session_namespace) is not bool:
        raise ValueError("Informe se os IDs de sessão são compatíveis entre as fontes.")
    parsed = parse_events(data)
    events = parsed["events"]
    signals, windows, seen_ips, sessions = [], {}, defaultdict(set), defaultdict(list)
    for event in events:
        if shared_session_namespace and event["sessao"] and event["usuario"]:
            sessions[(event["usuario"], event["sessao"])].append(event)

    def signal(label, evidence, hypothesis, alternative, next_step):
        signals.append({"sinal": label, "event_ids": [event["event_id"] for event in evidence], "observacao": "; ".join(f"{event['timestamp']} · {event['acao']} · {event['resultado']}" for event in evidence), "hipotese": hypothesis, "explicacao_alternativa": alternative, "proxima_verificacao": next_step})

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
                    signal("Login após falhas concentradas", list(queue) + [event], "Um acesso precisa de investigação após pelo menos cinco falhas em dez minutos.", "A pessoa pode ter esquecido a senha ou usado um cliente mal configurado.", "Confirmar a legitimidade do acesso por um canal conhecido e conferir os registros do provedor.")
                if seen_ips[event["usuario"]] and event["ip"] not in seen_ips[event["usuario"]]:
                    signal("Origem não vista antes neste arquivo", [event], "A conta foi usada a partir de um IP diferente dos sucessos anteriores presentes no recorte.", "VPN, provedor móvel ou trabalho remoto podem explicar a mudança. O recorte pode estar incompleto.", "Revisar contexto, dispositivo, MFA e a extensão do histórico disponível.")
                seen_ips[event["usuario"]].add(event["ip"])
        if event["origem"] == "identidade" and event["acao"] == "mfa_desativado" and event["resultado"] == "sucesso":
            signal("MFA desativado", [event], "Uma proteção da conta foi alterada antes ou durante o período investigado.", "Pode ter sido uma recuperação de conta aprovada pelo suporte.", "Conferir autorização, responsável, dispositivo e registro original da alteração.")
        if event["origem"] == "financeiro" and event["acao"] == "transferencia" and event["resultado"] == "sucesso" and event["valor_centavos"] is not None and event["valor_centavos"] >= transfer_threshold_brl * 100:
            signal("Transferência acima do limiar escolhido", [event], "A operação ultrapassa o limiar de triagem escolhido para este exercício.", "Uma transferência alta pode fazer parte da rotina e ter aprovação legítima.", "Conferir favorecido, aprovação, conciliação e confirmação com a equipe financeira.")

    for (_, session), group in sessions.items():
        changes = [event for event in group if event["resultado"] == "sucesso" and (event["origem"], event["acao"]) in {("identidade", "mfa_desativado"), ("financeiro", "alteracao_favorecido")}]
        transfers = [event for event in group if event["origem"] == "financeiro" and event["acao"] == "transferencia" and event["resultado"] == "sucesso"]
        for transfer in transfers:
            related = [event for event in changes if timedelta(0) <= datetime.fromisoformat(transfer["timestamp"]) - datetime.fromisoformat(event["timestamp"]) <= timedelta(minutes=30)]
            if related:
                signal("Alteração e transferência na mesma sessão", related + [transfer], f"Os registros compartilham a sessão {session} e ocorreram em até trinta minutos. Isso sustenta a investigação conjunta desses eventos.", "A própria equipe pode ter feito a alteração e a transferência com autorização.", "Confirmar como cada sistema define o ID de sessão, consultar aprovação e preservar os registros originais. IDs iguais de sistemas sem namespace compartilhado não provam vínculo.")
    transfers = [event for event in events if event["origem"] == "financeiro" and event["acao"] == "transferencia" and event["resultado"] == "sucesso"]
    return {**parsed, "signals": signals, "transfer_count": len(transfers), "transfer_total_centavos": sum(event["valor_centavos"] or 0 for event in transfers), "transfers_without_amount": sum(event["valor_centavos"] is None for event in transfers), "threshold_brl": transfer_threshold_brl, "shared_session_namespace": shared_session_namespace}
