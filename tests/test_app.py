from pathlib import Path

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]


def app():
    return AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()


def test_every_workspace_renders_without_exception():
    at = app()
    for page in at.radio(key="page").options:
        at.radio(key="page").set_value(page).run()
        assert not at.exception, (page, list(at.exception))


def test_scenario_changes_reset_answers_and_diagnostic_edits_survive_navigation():
    at = app()
    at.selectbox(key="scenario").set_value("Avaliação em branco").run()
    assert at.session_state["assets"] == []
    assert at.metric[2].value == "18"
    at.radio(key="page").set_value("Diagnóstico guiado").run()
    at.selectbox(key="answer_pr01").set_value("implemented").run()
    at.text_input(key="note_pr01").set_value("MFA fictício verificado no exercício.").run()
    at.radio(key="page").set_value("Plano e relatório").run()
    assert not at.exception
    assert at.session_state["answers"]["pr01"] == "implemented"
    assert "verificado" in at.session_state["notes"]["pr01"]
    at.selectbox(key="scenario").set_value("Escritório fictício").run()
    assert len(at.session_state["assets"]) == 2
    assert not at.exception


def test_log_workspace_switches_to_benign_and_notebook_retains_notes():
    at = app()
    at.radio(key="page").set_value("Investigar logs").run()
    assert [metric.value for metric in at.metric] == ["13", "7", "2", "R$ 60.000,00"]
    at.text_area[0].set_value("E008: alteração de MFA a confirmar.").run()
    select = next(widget for widget in at.selectbox if widget.label == "Caso de investigação")
    select.set_value("Caso benigno fictício").run()
    assert at.metric[1].value == "1"
    select = next(widget for widget in at.selectbox if widget.label == "Caso de investigação")
    select.set_value("Fraude financeira fictícia").run()
    assert "E008" in at.text_area[0].value
    assert not at.exception



def test_wifi_workspace_requires_evidence_and_preserves_notes_between_practices():
    at = app()
    at.radio(key="page").set_value("Laboratório de redes").run()
    at.radio(key="network_mode").set_value("Wi-Fi e roteador").run()
    assert not at.exception
    assert [metric.value for metric in at.metric] == ["6", "0", "0", "0"]
    at.selectbox(key="wifi_status_encryption").set_value("checked").run()
    assert at.session_state["wifi_review"]["answers"]["encryption"] == "unknown"
    assert at.warning
    at.text_area(key="wifi_note_encryption").set_value("WPA3 conferido no exercício fictício em 09/10.").run()
    at.selectbox(key="wifi_status_encryption").set_value("checked").run()
    assert at.session_state["wifi_review"]["answers"]["encryption"] == "checked"
    assert [metric.value for metric in at.metric] == ["5", "0", "1", "0"]
    at.radio(key="network_mode").set_value("Praticar com ferramentas").run()
    assert not at.exception
    at.radio(key="network_mode").set_value("Wi-Fi e roteador").run()
    assert not at.exception
    assert at.selectbox(key="wifi_status_encryption").value == "checked"
    assert "WPA3" in at.text_area(key="wifi_note_encryption").value
