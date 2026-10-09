"""Avaliação transparente de declarações; não mede probabilidade de ataque."""

from .controls import BY_ID, CONTROLS, STATUS_LABELS


def assess(answers: dict, notes: dict | None = None) -> dict:
    """Calcule atendimento declarado e uma fila de ação explicável."""
    notes = {} if notes is None else notes
    if not isinstance(answers, dict) or not isinstance(notes, dict):
        raise ValueError("Respostas e evidências precisam ser objetos.")
    if set(answers) - BY_ID.keys() or set(notes) - BY_ID.keys():
        raise ValueError("A avaliação contém controles desconhecidos.")
    total_weight = earned = 0.0
    unknown = applicable = implemented = evidence_count = 0
    actions, rows = [], []
    areas = {}
    credit = {"implemented": 1.0, "partial": 0.5, "absent": 0.0, "unknown": 0.0}
    for control in CONTROLS:
        status = answers.get(control.id, "unknown")
        note = notes.get(control.id, "")
        if not isinstance(status, str) or status not in STATUS_LABELS:
            raise ValueError(f"Estado inválido no controle {control.id}.")
        if not isinstance(note, str) or len(note) > 1000:
            raise ValueError("Cada evidência ou justificativa deve ter até 1.000 caracteres.")
        if status == "na" and not note.strip():
            raise ValueError(f"Justifique por que {control.title} não se aplica.")
        rows.append({"id": control.id, "area": control.area, "controle": control.title, "estado": STATUS_LABELS[status], "nota": note})
        if status == "na":
            continue
        applicable += 1
        implemented += status == "implemented"
        unknown += status == "unknown"
        evidence_count += bool(note.strip())
        total_weight += control.weight
        earned += control.weight * credit[status]
        area = areas.setdefault(control.area, {"peso": 0, "atendido": 0.0})
        area["peso"] += control.weight
        area["atendido"] += control.weight * credit[status]
        if status != "implemented":
            actions.append({
                "origem": "Diagnóstico", "item": control.title,
                "prioridade": "Alta" if control.weight >= 4 else "Média",
                "peso": control.weight * (1 - credit[status]),
                "prazo_dias": control.days,
                "motivo": "Estado desconhecido; confirmar antes de concluir." if status == "unknown" else f"Controle declarado como {STATUS_LABELS[status].lower()}.",
                "acao": f"Confirmar o estado e as evidências de: {control.title}. Depois, {control.action[0].lower() + control.action[1:]}" if status == "unknown" else control.action,
            })
        elif not note.strip():
            actions.append({"origem": "Evidências", "item": control.title, "prioridade": "Revisar", "peso": 0.25 * control.weight, "prazo_dias": 30, "motivo": "Implementação declarada sem evidência registrada.", "acao": f"Registrar evidência de {control.title.lower()} e revisá-la com a equipe."})
    actions.sort(key=lambda item: (-item["peso"], item["prazo_dias"], item["item"]))
    return {
        "score": round(100 * earned / total_weight, 1) if total_weight else None,
        "applicable": applicable, "implemented": implemented,
        "unknown": unknown, "evidence_count": evidence_count,
        "actions": actions, "controls": rows,
        "areas": [{"area": area, "atendimento_pct": round(100 * item["atendido"] / item["peso"], 1)} for area, item in areas.items()],
    }
