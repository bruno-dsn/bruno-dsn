import csv
import io
import json
from pathlib import Path

import pytest

from netguard.assessment import assess
from netguard.controls import CONTROLS
from netguard.reports import action_plan, decode_snapshot, encode_snapshot, html_report, safe_csv

ROOT = Path(__file__).resolve().parents[1]


def test_unknown_is_visible_and_requests_confirmation():
    result = assess({})
    assert result["score"] == 0
    assert result["unknown"] == len(CONTROLS)
    assert all("Confirmar" in row["acao"] for row in result["actions"])
    assert all("confirmar" in row["motivo"] for row in result["actions"])


def test_partial_credit_and_evidence_are_separate():
    answers = {control.id: "partial" for control in CONTROLS}
    assert assess(answers)["score"] == 50
    answers = {control.id: "implemented" for control in CONTROLS}
    result = assess(answers)
    assert result["score"] == 100
    assert result["evidence_count"] == 0
    assert {row["origem"] for row in result["actions"]} == {"Evidências"}
    notes = {control.id: "Evidência fictícia para o teste." for control in CONTROLS}
    assert assess(answers, notes)["actions"] == []


def test_not_applicable_requires_reason_and_all_excluded_has_no_score():
    answers = {control.id: "na" for control in CONTROLS}
    with pytest.raises(ValueError, match="Justifique"):
        assess(answers)
    result = assess(answers, {control.id: "Fora do escopo deste exercício." for control in CONTROLS})
    assert result["score"] is None
    assert result["applicable"] == 0
    assert result["areas"] == []


@pytest.mark.parametrize("answers,notes", [([], {}), ({}, []), ({"inexistente": "implemented"}, {}), ({"gv01": []}, {}), ({}, {"gv01": 42})])
def test_assessment_rejects_malformed_inputs(answers, notes):
    with pytest.raises(ValueError):
        assess(answers, notes)


def test_snapshot_roundtrip_preserves_answers_and_validates_structure():
    scenario = decode_snapshot((ROOT / "data/cenario-loja.json").read_bytes())
    exported = encode_snapshot(scenario["cenario"], scenario["answers"], scenario["notes"], scenario["assets"])
    assert decode_snapshot(exported) == scenario
    scenario["schema_version"] = True
    with pytest.raises(ValueError):
        decode_snapshot(json.dumps(scenario).encode())


@pytest.mark.parametrize("contents", [b'{"schema_version":1,"schema_version":1}', b'[]', b'{', b' ' * (2 * 1024 * 1024 + 1)])
def test_snapshot_rejects_duplicate_keys_invalid_json_and_oversize(contents):
    with pytest.raises(ValueError):
        decode_snapshot(contents)


def test_report_escapes_user_content_and_keeps_method_visible():
    attack = '<script>alert("x")</script>'
    result = html_report(attack, {}, {"gv01": attack}, []).decode()
    assert "<script>" not in result
    assert "&lt;script&gt;" in result
    assert "probabilidade de ataque" in result
    assert "Não houve varredura" in result


def test_csv_exports_do_not_turn_user_text_into_formulas():
    contents = safe_csv([{"nome": "  =HYPERLINK(\"x\")", "valor": -1}, {"nome": "@SUM(1)", "valor": 2}], ["nome", "valor"])
    rows = list(csv.DictReader(io.StringIO(contents.decode("utf-8-sig"))))
    assert rows[0]["nome"].startswith("'")
    assert rows[1]["nome"].startswith("'")
    assert rows[0]["valor"] == "-1"


def test_plan_includes_declared_exposure_and_unconfirmed_controls():
    scenario = decode_snapshot((ROOT / "data/cenario-loja.json").read_bytes())
    plan = action_plan(scenario["answers"], scenario["notes"], scenario["assets"])
    assert plan[0]["prioridade"] == "Urgente"
    assert "RDP" in plan[0]["motivo"]
    assert any("confirmar" in row["motivo"] for row in plan)

