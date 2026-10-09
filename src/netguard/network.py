"""Conceitos de redes calculados em memória, sem sondar hosts."""

import ipaddress


def subnet_info(cidr: str) -> dict:
    try:
        network = ipaddress.ip_network(cidr.strip(), strict=False)
    except (ValueError, AttributeError) as error:
        raise ValueError("Informe uma rede válida, como 192.168.10.0/24.") from error
    reserved = 2 if network.version == 4 and network.prefixlen <= 30 else (1 if network.version == 6 and network.prefixlen < 127 else 0)
    first = int(network.network_address) + (1 if reserved else 0)
    last = int(network.broadcast_address) - (1 if reserved == 2 else 0)
    address = ipaddress.IPv4Address if network.version == 4 else ipaddress.IPv6Address
    return {"rede": str(network), "versao": network.version, "mascara": str(network.netmask), "enderecos": network.num_addresses, "hosts_utilizaveis": network.num_addresses - reserved, "primeiro_host": str(address(first)), "ultimo_host": str(address(last)), "broadcast": str(network.broadcast_address) if network.version == 4 else "IPv6 não usa broadcast"}


def overlap_pairs(segments: dict[str, str]) -> list[tuple[str, str]]:
    try:
        networks = {label: ipaddress.ip_network(value.strip(), strict=True) for label, value in segments.items()}
    except ValueError as error:
        raise ValueError("Informe redes válidas sem bits de host no endereço de rede.") from error
    labels = list(networks)
    return [(a, b) for i, a in enumerate(labels) for b in labels[i + 1:] if networks[a].version == networks[b].version and networks[a].overlaps(networks[b])]


ZONES = ("administracao", "interna", "servidores", "visitantes", "iot", "internet")


def policy_decision(source: str, destination: str, port: int) -> dict:
    if source not in ZONES or destination not in ZONES or isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError("Escolha zonas válidas e uma porta entre 1 e 65535.")
    # A pequena política é um exercício próprio; não é exportada para um firewall.
    rules = (
        ("administracao", "servidores", {22, 443}, "Administração dos servidores por zona dedicada."),
        ("interna", "servidores", {443}, "Acesso interno ao serviço web autorizado."),
        ("interna", "internet", {443}, "Navegação HTTPS no cenário simplificado."),
        ("visitantes", "internet", {443}, "Visitantes navegam na internet, sem acesso interno."),
        ("administracao", "internet", {443}, "Navegação HTTPS da equipe administrativa."),
    )
    for origin, target, ports, reason in rules:
        if source == origin and destination == target and port in ports:
            return {"decisao": "Permitir", "motivo": reason}
    return {"decisao": "Bloquear", "motivo": "Nenhuma regra do exercício permite essa conexão; aplica-se a negação padrão."}
