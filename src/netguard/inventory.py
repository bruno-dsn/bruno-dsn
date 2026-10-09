"""Importação limitada e análise offline do inventário informado."""

import csv
import io
import ipaddress
import re


FIELDS = ("id", "nome", "tipo", "zona", "ip", "exposto_internet", "mfa", "atualizado", "backup_testado", "portas")
TYPES = ("computador", "servidor", "roteador", "switch", "iot", "nuvem", "email")
ZONES = ("administracao", "interna", "servidores", "visitantes", "iot", "nuvem")
STATES = ("sim", "nao", "desconhecido")
MAX_BYTES = 2 * 1024 * 1024


def normalize_inventory(records: list) -> list[dict]:
    if not isinstance(records, list) or len(records) > 500:
        raise ValueError("O inventário precisa conter uma lista com até 500 ativos.")
    normalized, ids = [], set()
    for number, record in enumerate(records, 1):
        if not isinstance(record, dict) or set(record) != set(FIELDS):
            raise ValueError(f"Linha {number}: use as colunas exatas do CSV de exemplo.")
        if any(not isinstance(value, str) for value in record.values()):
            raise ValueError(f"Linha {number}: todos os campos devem ser textos.")
        item = {key: value.strip() for key, value in record.items()}
        if any(len(value) > 200 for value in item.values()):
            raise ValueError(f"Linha {number}: campo acima de 200 caracteres.")
        if not item["id"] or not item["nome"] or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", item["id"]):
            raise ValueError(f"Linha {number}: informe ID simples e nome do ativo.")
        if item["id"] in ids:
            raise ValueError(f"ID duplicado: {item['id']}.")
        ids.add(item["id"])
        if item["tipo"] not in TYPES or item["zona"] not in ZONES:
            raise ValueError(f"Linha {number}: tipo ou zona não reconhecidos.")
        for key in ("exposto_internet", "mfa", "atualizado", "backup_testado"):
            if item[key] not in STATES:
                raise ValueError(f"Linha {number}: {key} aceita sim, nao ou desconhecido.")
        if item["ip"]:
            try:
                item["ip"] = str(ipaddress.ip_address(item["ip"]))
            except ValueError as error:
                raise ValueError(f"Linha {number}: endereço IP inválido.") from error
        ports = []
        if item["portas"]:
            for value in item["portas"].split(","):
                if not value.strip().isdigit() or not 1 <= int(value) <= 65535:
                    raise ValueError(f"Linha {number}: informe portas de 1 a 65535 separadas por vírgula.")
                ports.append(int(value))
        item["portas"] = ",".join(map(str, sorted(set(ports))))
        normalized.append(item)
    return normalized


def read_inventory(data: bytes) -> list[dict]:
    if len(data) > MAX_BYTES:
        raise ValueError("O arquivo deve ter no máximo 2 MB.")
    try:
        reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
        if reader.fieldnames is None or len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("O CSV precisa de cabeçalho com colunas únicas.")
        records = []
        for row in reader:
            records.append(row)
            if len(records) > 500:
                raise ValueError("O inventário aceita até 500 ativos.")
        if set(reader.fieldnames) != set(FIELDS):
            raise ValueError("Cabeçalho inválido; baixe o CSV de exemplo.")
        return normalize_inventory(records)
    except (UnicodeDecodeError, csv.Error) as error:
        raise ValueError("Use um CSV UTF-8 no formato do exemplo.") from error


def analyze_inventory(records: list[dict]) -> list[dict]:
    records = normalize_inventory(records)
    findings = []
    exposed_services = {21: "FTP", 23: "Telnet", 445: "SMB", 3389: "RDP", 5900: "VNC", 3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis", 27017: "MongoDB"}
    for item in records:
        def add(priority, weight, reason, action):
            findings.append({"origem": "Inventário", "item": item["nome"], "prioridade": priority, "peso": weight, "prazo_dias": 7 if weight >= 4 else 14, "motivo": reason, "acao": action})
        if item["exposto_internet"] == "desconhecido":
            add("Média", 3, "Exposição externa não informada.", "Confirmar a exposição com o responsável pela rede e atualizar o inventário.")
        elif item["exposto_internet"] == "sim":
            sensitive = [exposed_services[int(port)] for port in item["portas"].split(",") if port and int(port) in exposed_services]
            if sensitive:
                add("Urgente", 6, "Exposição declarada de " + ", ".join(sensitive) + ".", "Revisar a necessidade de exposição; restringir o serviço por regras de acesso e uma solução de acesso remoto aprovada. Validar a mudança para evitar interromper o negócio.")
            if item["mfa"] == "nao" and item["tipo"] in {"email", "nuvem", "servidor", "roteador"}:
                add("Alta", 5, "Serviço exposto declarado sem MFA.", "Verificar o suporte a MFA e habilitá-lo nas contas críticas; documentar a recuperação do acesso.")
        if item["atualizado"] == "nao":
            add("Alta", 4, "Ativo declarado sem atualização.", "Verificar suporte e atualizações com o responsável; planejar aplicação e retorno em caso de falha.")
        if item["backup_testado"] == "nao" and item["tipo"] in {"computador", "servidor", "nuvem", "email"}:
            add("Alta", 4, "Restauração declarada como não testada.", "Testar a restauração de um dado essencial em ambiente separado e registrar integridade e tempo.")
        missing = [key for key in ("mfa", "atualizado", "backup_testado") if item[key] == "desconhecido"]
        if missing:
            add("Revisar", 2, "Informações desconhecidas: " + ", ".join(missing) + ".", "Confirmar os campos desconhecidos com o responsável pelo ativo. A ausência de informação não comprova uma vulnerabilidade.")
    return sorted(findings, key=lambda row: (-row["peso"], row["item"]))
