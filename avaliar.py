"""Gere um relatório offline pela linha de comando."""

import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))
from netguard.reports import action_plan, decode_snapshot, html_report, safe_csv  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Avalie um snapshot local do NetGuard Lab.")
    parser.add_argument("--avaliacao", type=Path, default=Path("data/cenario-loja.json"))
    parser.add_argument("--saida", type=Path, default=Path("reports/loja"))
    arguments = parser.parse_args()
    try:
        if arguments.avaliacao.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("A avaliação deve ter até 2 MB.")
        snapshot = decode_snapshot(arguments.avaliacao.read_bytes())
        plan = action_plan(snapshot["answers"], snapshot["notes"], snapshot["assets"])
        arguments.saida.parent.mkdir(parents=True, exist_ok=True)
        arguments.saida.with_suffix(".html").write_bytes(html_report(snapshot["cenario"], snapshot["answers"], snapshot["notes"], snapshot["assets"]))
        arguments.saida.with_suffix(".csv").write_bytes(safe_csv(plan, ["prioridade", "origem", "item", "motivo", "acao", "prazo_dias"]))
        print(f"{len(plan)} ações organizadas. Relatórios: {arguments.saida}.html e .csv")
    except (OSError, ValueError) as error:
        parser.exit(1, f"Não foi possível gerar o relatório: {error}\n")


if __name__ == "__main__":
    main()
