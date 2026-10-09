"""Explicações de campos e eventos em linguagem simples, sem inferir autoria."""

FIELD_GUIDE = {
    "event_id": (
        "Qual registro?",
        "É o identificador do evento. Use-o nas anotações para que outra pessoa encontre a mesma evidência.",
    ),
    "timestamp": (
        "Quando?",
        "Data e hora informadas pelo sistema. Convertidas para UTC para comparar fontes; confirme se os relógios estavam sincronizados.",
    ),
    "origem": (
        "Qual sistema?",
        "Indica a categoria da fonte. Um registro de rede e um do banco podem descrever coisas diferentes.",
    ),
    "usuario": (
        "Qual conta?",
        "É a conta informada no registro. Não identifica, por si só, a pessoa que estava usando a conta.",
    ),
    "ip": (
        "Qual endereço?",
        "É o endereço informado pelo sistema. VPN, NAT e proxies podem fazer várias pessoas usarem o mesmo IP.",
    ),
    "sessao": (
        "Qual sessão?",
        "Agrupa eventos conforme a definição do sistema. IDs iguais entre sistemas só podem ser correlacionados após confirmar o namespace.",
    ),
    "acao": (
        "O que foi feito?",
        "É o nome da operação registrada: por exemplo, login ou transferencia. Confira como a fonte define a ação.",
    ),
    "resultado": (
        "Qual resultado?",
        "Sucesso significa que a fonte registrou sucesso; não comprova aprovação legítima, liquidação bancária ou ausência de fraude.",
    ),
    "recurso": (
        "Em qual recurso?",
        "É o alvo informado: serviço, dispositivo ou favorecido. Pode conter informação sensível.",
    ),
    "valor_brl": (
        "Qual valor?",
        "Valor em reais informado neste evento. Vazio é desconhecido, não zero. Confira a conciliação antes de estimar prejuízo.",
    ),
}


def explain_event(event: dict) -> str:
    account = event["usuario"] or "uma conta não informada"
    address = f" a partir do endereço {event['ip']}" if event["ip"] else " sem endereço IP informado"
    return f"Em {event['timestamp']}, a fonte {event['origem']} registrou a ação {event['acao']} para {account}{address}. O resultado informado foi {event['resultado']}. Isso descreve o registro, não a identidade da pessoa ou a causa do ocorrido."
