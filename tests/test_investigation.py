import csv
import hashlib
import io
from pathlib import Path

import pytest

from netguard.investigation import FIELDS, investigate, parse_events
from netguard.logs import analyze_auth_csv

ROOT = Path(__file__).resolve().parents[1]


def encode(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode()


def read_case():
    contents = (ROOT / "data/caso-financeiro-ficticio.csv").read_bytes()
    return list(csv.DictReader(io.StringIO(contents.decode("utf-8-sig")))), contents


def test_financial_case_keeps_original_hash_evidence_ids_and_exact_money():
    rows, contents = read_case()
    result = investigate(contents, shared_session_namespace=True)
    assert result["sha256"] == hashlib.sha256(contents).hexdigest()
    assert result["bytes"] == len(contents)
    assert result["transfer_count"] == 2
    assert result["transfer_total_centavos"] == 6000000
    assert len(result["signals"]) == 7
    ids = {row["event_id"] for row in rows}
    assert all(set(signal["event_ids"]) <= ids for signal in result["signals"])
    assert all(signal["explicacao_alternativa"] and signal["proxima_verificacao"] for signal in result["signals"])
    assert all("E009" not in signal["event_ids"] for signal in result["signals"])


def test_cross_source_correlation_is_off_until_session_compatibility_confirmed():
    _, contents = read_case()
    default = investigate(contents)
    assert not any(signal["sinal"] == "Alteração e transferência na mesma sessão" for signal in default["signals"])


@pytest.mark.parametrize("field,value", [("usuario", "outra.conta"), ("sessao", "outra-sessao"), ("timestamp", "2026-10-08T13:20:00Z")])
def test_different_user_session_or_time_does_not_get_correlated(field, value):
    rows, _ = read_case()
    changed = next(row for row in rows if row["event_id"] == "E011")
    changed[field] = value
    result = investigate(encode(rows), shared_session_namespace=True)
    correlated = [signal for signal in result["signals"] if signal["sinal"] == "Alteração e transferência na mesma sessão"]
    assert all("E011" not in signal["event_ids"] for signal in correlated)


def test_benign_case_demonstrates_false_positive_without_large_transfer():
    result = investigate((ROOT / "data/caso-benigno-ficticio.csv").read_bytes(), shared_session_namespace=True)
    assert len(result["signals"]) == 1
    assert result["signals"][0]["sinal"] == "Login após falhas concentradas"
    assert "esquecido" in result["signals"][0]["explicacao_alternativa"]
    assert result["transfer_total_centavos"] == 80000


def test_missing_amount_is_not_silently_counted_as_known_zero():
    rows, _ = read_case()
    next(row for row in rows if row["event_id"] == "E011")["valor_brl"] = ""
    result = investigate(encode(rows))
    assert result["transfer_total_centavos"] == 3200000
    assert result["transfers_without_amount"] == 1


@pytest.mark.parametrize("amount", ["NaN", "Infinity", "-1", "1.009", "1000000000001", "um valor"])
def test_money_rejects_invalid_precision_nonfinite_and_out_of_range(amount):
    rows, _ = read_case()
    rows[-1]["valor_brl"] = amount
    with pytest.raises(ValueError):
        parse_events(encode(rows))


def test_timestamps_are_normalized_and_sorted_as_instants_not_text():
    rows, _ = read_case()
    rows = rows[:2]
    rows[0]["timestamp"] = "2026-10-08T09:00:00.100000-03:00"
    rows[1]["timestamp"] = "2026-10-08T12:00:00Z"
    events = parse_events(encode(rows))["events"]
    assert [event["event_id"] for event in events] == ["E002", "E001"]
    assert events[1]["timestamp"] == "2026-10-08T12:00:00.100000+00:00"


@pytest.mark.parametrize("field,value", [("timestamp", "2026-10-08T12:00:00"), ("ip", "invalid"), ("event_id", ""), ("resultado", "unknown")])
def test_event_contract_rejects_missing_timezone_ip_id_or_outcome(field, value):
    rows, _ = read_case()
    rows[0][field] = value
    with pytest.raises(ValueError):
        parse_events(encode(rows))


def test_event_duplicate_ids_and_extra_columns_rejected():
    rows, _ = read_case()
    with pytest.raises(ValueError):
        parse_events(encode([rows[0], rows[0]]))
    with pytest.raises(ValueError):
        parse_events(b"event_id,timestamp,extra\na,x,y\n")


def test_auth_rule_respects_user_and_window_and_success_context():
    contents = (ROOT / "data/log-autenticacao-exemplo.csv").read_bytes()
    signals = analyze_auth_csv(contents)
    assert {item["sinal"] for item in signals} == {"Falhas concentradas", "Falhas seguidas de sucesso"}
    assert analyze_auth_csv(contents, threshold=10) == []
    assert analyze_auth_csv(contents, threshold=5, window_minutes=1) == []
    with pytest.raises(ValueError):
        analyze_auth_csv(contents, threshold=5.5)

