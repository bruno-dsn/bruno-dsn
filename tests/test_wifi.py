import json

import pytest

from netguard.wifi import CONTROLS, decode_review, encode_review, new_review, review_report, review_summary, validate_review


def test_unknown_wifi_answers_are_confirmation_tasks_without_a_score():
    review = new_review()
    summary = review_summary(review)
    assert summary["counts"] == {"unknown": 6, "review": 0, "checked": 0, "na": 0}
    assert len(summary["tasks"]) == 6
    assert summary["tasks"][0]["action"] == CONTROLS[0]["verify"]
    review["answers"]["encryption"] = "review"
    assert review_summary(review)["tasks"][0]["action"] == CONTROLS[0]["next"]
    assert "score" not in summary


@pytest.mark.parametrize("status", ["checked", "na"])
def test_evidence_is_required_for_checked_and_not_applicable(status):
    review = new_review()
    review["answers"]["encryption"] = status
    review["notes"]["encryption"] = "  "
    with pytest.raises(ValueError, match="exigem"):
        validate_review(review)
    review["notes"]["encryption"] = "Configuração e data conferidas no exercício fictício."
    assert len(review_summary(review)["tasks"]) == 5
    assert decode_review(encode_review(review)) == review


@pytest.mark.parametrize("change", [
    lambda r: r.update(schema_version=True),
    lambda r: r.update(kind="assessment"),
    lambda r: r.update(extra="ignored?"),
    lambda r: r["notes"].pop("guest"),
    lambda r: r["answers"].update(guest="secure"),
    lambda r: r["notes"].update(guest="x" * 1001),
    lambda r: r.update(network_name=" "),
])
def test_restore_rejects_invalid_wifi_review(change):
    review = new_review()
    change(review)
    with pytest.raises(ValueError):
        decode_review(json.dumps(review).encode())


def test_duplicate_json_keys_and_oversized_input_are_rejected():
    source = encode_review(new_review()).replace(b'"schema_version": 1', b'"schema_version": 1, "schema_version": 1')
    with pytest.raises(ValueError, match="repetida"):
        decode_review(source)
    with pytest.raises(ValueError, match="2 MB"):
        decode_review(b" " * (2 * 1024 * 1024 + 1))


def test_report_escapes_names_notes_and_has_no_script():
    review = new_review()
    review["network_name"] = '<img src=x onerror="alert(1)">'
    review["notes"]["encryption"] = '<script>alert("segredo")</script>'
    review["answers"]["encryption"] = "checked"
    report = review_report(review).decode()
    assert "<script>" not in report and "<img" not in report
    assert "&lt;script&gt;" in report and "default-src 'none'" in report
    assert "não conectou equipamentos" in report
