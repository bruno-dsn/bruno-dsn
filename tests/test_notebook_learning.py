import csv
import io
import json
from pathlib import Path

import pytest

from netguard.investigation import FIELDS, format_brl, investigate, parse_events
from netguard.learning import FIELD_GUIDE, explain_event
from netguard.notebook import NOTE_FIELDS, decode_notebook, encode_notebook, investigation_report

ROOT = Path(__file__).resolve().parents[1]
CSV = (ROOT / "data/caso-financeiro-ficticio.csv").read_bytes()


def notebook():
    result = investigate(CSV, shared_session_namespace=True)
    notes = dict.fromkeys(NOTE_FIELDS, "")
    notes["observacoes"] = "E008 informa desativação de MFA."
    return result, notes, encode_notebook(result, notes, "Caso fictício")


def test_jsonl_and_csv_have_the_same_normalized_events_signals_and_money():
    a = investigate(CSV, shared_session_namespace=True)
    b = investigate(
        (ROOT / "data/caso-financeiro-ficticio.jsonl").read_bytes(), shared_session_namespace=True, file_format="jsonl"
    )
    for key in ("events", "signals", "transfer_total_centavos", "signal_count"):
        assert a[key] == b[key]
    assert a["sha256"] != b["sha256"]


def test_notebook_round_trip_and_existing_v1_contract():
    result, notes, encoded = notebook()
    restored = decode_notebook(encoded, result)
    assert restored["notas"] == notes
    assert restored["ids_sessao_compativeis"] is True


@pytest.mark.parametrize(
    "key,value",
    [
        ("schema_version", True),
        ("bytes", True),
        ("arquivo_sha256", "0" * 64),
        ("ids_eventos", ["outro"]),
        ("limiar_transferencia_brl", True),
        ("ids_sessao_compativeis", 1),
        ("caso", "x" * 101),
        ("notas", {"observacoes": ""}),
    ],
)
def test_notebook_rejects_wrong_file_version_parameters_or_notes(key, value):
    result, _, encoded = notebook()
    changed = json.loads(encoded)
    changed[key] = value
    with pytest.raises(ValueError):
        decode_notebook(json.dumps(changed).encode(), result)


def test_notebook_rejects_duplicate_keys_extra_keys_and_oversized_notes():
    result, notes, encoded = notebook()
    with pytest.raises(ValueError):
        decode_notebook(encoded.replace(b'"schema_version": 1', b'"schema_version": 1, "schema_version": 1'), result)
    changed = json.loads(encoded)
    changed["extra"] = "value"
    with pytest.raises(ValueError):
        decode_notebook(json.dumps(changed).encode(), result)
    notes["observacoes"] = "a" * 3001
    with pytest.raises(ValueError):
        encode_notebook(result, notes, "Caso")


def test_report_escapes_every_user_surface_and_has_no_active_scripts():
    result, notes, _ = notebook()
    notes["observacoes"] = '<img src=x onerror="alert(1)"><script>alert(1)</script>'
    result["events"][0]["usuario"] = "<svg onload=alert(1)>"
    output = investigation_report(result, notes, "<script>caso</script>").decode()
    assert "<script>" not in output and "<img" not in output and "<svg" not in output
    assert "&lt;script&gt;" in output and "default-src 'none'" in output


def test_field_guide_explains_identity_timezone_and_unknown_amount():
    result, _, _ = notebook()
    assert set(FIELD_GUIDE) == set(FIELDS)
    assert "pessoa" in FIELD_GUIDE["usuario"][1]
    assert "não zero" in FIELD_GUIDE["valor_brl"][1]
    assert "não a identidade" in explain_event(result["events"][0])


def test_financial_display_keeps_centavos_in_large_integer_totals():
    assert format_brl(1000000000000000001) == "R$ 10.000.000.000.000.000,01"


def test_web_catalog_and_examples_match_the_python_sources():
    from dataclasses import asdict
    from netguard.controls import CONTROLS, STATUS_LABELS

    catalog = json.loads((ROOT / "web/data/controls.json").read_text())
    assert catalog == {"controls": [asdict(control) for control in CONTROLS], "statuses": STATUS_LABELS}
    for original in (ROOT / "data").iterdir():
        assert original.read_bytes() == (ROOT / "web/data" / original.name).read_bytes()


@pytest.mark.parametrize(
    "data,format",
    [
        (b"", "csv"),
        (b'event_id,"timestamp\n', "csv"),
        (b"{}\n", "jsonl"),
        (b"[]\n", "jsonl"),
        (b'{"event_id":"a","event_id":"b"}\n', "jsonl"),
        (b"\xff", "csv"),
    ],
)
def test_import_rejects_empty_malformed_utf8_or_duplicate_json(data, format):
    with pytest.raises(ValueError):
        parse_events(data, format)


def test_new_ip_signal_carries_both_reference_and_new_login_evidence():
    signal = next(
        item for item in investigate(CSV)["signals"] if item["sinal"] == "Origem não vista antes neste arquivo"
    )
    assert signal["event_ids"] == ["E001", "E007"]


def test_large_case_bounds_signal_and_evidence_display_without_losing_totals():
    base = list(csv.DictReader(io.StringIO(CSV.decode("utf-8-sig"))))[7]
    rows = [{**base, "event_id": f"E{i:05}"} for i in range(1100)]
    transfer = {
        **base,
        "event_id": "Z",
        "timestamp": "2026-10-08T12:20:00Z",
        "origem": "financeiro",
        "acao": "transferencia",
        "valor_brl": "28000.00",
    }
    rows.append(transfer)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    result = investigate(buffer.getvalue().encode(), shared_session_namespace=True)
    assert len(result["events"]) == 1101
    assert len(result["signals"]) == 1000 and result["signal_count"] == 1102 and result["signals_omitted"] == 102
    assert result["transfer_total_centavos"] == 2800000
    # A separate small result keeps the full count of omitted evidence in one card.
    smaller = [dict(row, acao="alteracao_favorecido", origem="financeiro") for row in rows[:60]] + [transfer]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(smaller)
    item = investigate(buffer.getvalue().encode(), shared_session_namespace=True)["signals"][-1]
    assert len(item["event_ids"]) == 50 and item["evidencias_omitidas"] == 11
