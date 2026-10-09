"""Triagem de eventos fictícios ou fornecidos, com uma regra explicável."""

from collections import deque
from datetime import datetime, timedelta, timezone
import csv
import io
import ipaddress


def analyze_auth_csv(data: bytes, threshold: int = 5, window_minutes: int = 10) -> list[dict]:
    if len(data) > 2 * 1024 * 1024:
        raise ValueError("O log deve ter até 2 MB.")
    if type(threshold) is not int or type(window_minutes) is not int or not 2 <= threshold <= 20 or not 1 <= window_minutes <= 60:
        raise ValueError("Use 2 a 20 falhas e uma janela de 1 a 60 minutos.")
    try:
        reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
        if reader.fieldnames is None or set(reader.fieldnames) != {"timestamp", "usuario", "ip", "resultado"} or len(reader.fieldnames) != 4:
            raise ValueError("O log exige timestamp,usuario,ip,resultado.")
        events = []
        for index, row in enumerate(reader, 1):
            if index > 10000 or set(row) != set(reader.fieldnames):
                raise ValueError("Log fora do contrato ou acima de 10.000 eventos.")
            if any(not isinstance(value, str) or len(value) > 120 for value in row.values()):
                raise ValueError("Campos inválidos no log.")
            instant = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
            if instant.tzinfo is None:
                raise ValueError("Informe fuso no timestamp, como Z ou +00:00.")
            ip = str(ipaddress.ip_address(row["ip"]))
            if not row["usuario"].strip() or row["resultado"] not in {"falha", "sucesso"}:
                raise ValueError("Informe usuário e resultado falha ou sucesso.")
            events.append((instant.astimezone(timezone.utc), row["usuario"].strip(), ip, row["resultado"]))
    except (UnicodeDecodeError, csv.Error, TypeError) as error:
        raise ValueError("Use um CSV UTF-8 no contrato do exemplo.") from error
    events.sort(key=lambda event: event[0])
    windows, found = {}, {}
    for instant, user, ip, outcome in events:
        key = (user, ip)
        queue = windows.setdefault(key, deque())
        while queue and instant - queue[0] > timedelta(minutes=window_minutes):
            queue.popleft()
        if outcome == "falha":
            queue.append(instant)
        if len(queue) >= threshold:
            kind = "Falhas seguidas de sucesso" if outcome == "sucesso" else "Falhas concentradas"
            found[(key, kind)] = {"usuario": user, "ip": ip, "sinal": kind, "falhas_na_janela": len(queue), "timestamp": instant.isoformat(), "interpretacao": "Sinal para triagem. Verifique contexto, origem e legitimidade do acesso; a regra não confirma invasão."}
    return list(found.values())
