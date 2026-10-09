from pathlib import Path

import pytest

from netguard.inventory import analyze_inventory, normalize_inventory, read_inventory
from netguard.network import overlap_pairs, policy_decision, subnet_info

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def asset():
    return {"id": "web-01", "nome": "Servidor de exemplo", "tipo": "servidor", "zona": "servidores", "ip": "192.0.2.10", "exposto_internet": "sim", "mfa": "sim", "atualizado": "sim", "backup_testado": "sim", "portas": "443"}


def test_https_alone_does_not_indicate_vulnerability_but_rdp_needs_review(asset):
    assert analyze_inventory([asset]) == []
    asset["portas"] = "3389,443,3389"
    assert normalize_inventory([asset])[0]["portas"] == "443,3389"
    findings = analyze_inventory([asset])
    assert len(findings) == 1
    assert findings[0]["prioridade"] == "Urgente"
    assert "Exposição declarada" in findings[0]["motivo"]


def test_unknown_exposure_does_not_assert_detected_exposure(asset):
    asset["exposto_internet"] = "desconhecido"
    asset["portas"] = "3389"
    findings = analyze_inventory([asset])
    assert {row["prioridade"] for row in findings} == {"Média"}
    assert "Confirmar" in findings[0]["acao"]


@pytest.mark.parametrize("field,value", [("ip", "999.1.2.3"), ("portas", "65536"), ("portas", "0"), ("tipo", "outro"), ("mfa", None), ("nome", "x" * 201)])
def test_inventory_rejects_invalid_assets(asset, field, value):
    asset[field] = value
    with pytest.raises(ValueError):
        normalize_inventory([asset])


def test_inventory_rejects_duplicate_ids_and_excess_rows(asset):
    with pytest.raises(ValueError, match="duplicado"):
        normalize_inventory([asset, asset])
    with pytest.raises(ValueError, match="500"):
        normalize_inventory([asset] * 501)


def test_csv_example_loads_and_incomplete_rows_fail():
    assert len(read_inventory((ROOT / "data/inventario-exemplo.csv").read_bytes())) == 4
    with pytest.raises(ValueError):
        read_inventory(b"id,nome\nx,Exemplo\n")


@pytest.mark.parametrize("cidr,hosts,first,last", [
    ("192.168.10.99/24", 254, "192.168.10.1", "192.168.10.254"),
    ("192.0.2.0/31", 2, "192.0.2.0", "192.0.2.1"),
    ("192.0.2.8/32", 1, "192.0.2.8", "192.0.2.8"),
    ("::/127", 2, "::", "::1"),
    ("::1/128", 1, "::1", "::1"),
])
def test_subnet_boundaries_include_point_to_point_and_ipv6(cidr, hosts, first, last):
    info = subnet_info(cidr)
    assert info["hosts_utilizaveis"] == hosts
    assert info["primeiro_host"] == first
    assert info["ultimo_host"] == last


def test_overlap_detects_nested_subnets_and_keeps_protocols_separate():
    assert overlap_pairs({"A": "192.0.2.0/24", "B": "192.0.2.0/25", "C": "2001:db8::/64"}) == [("A", "B")]
    with pytest.raises(ValueError):
        overlap_pairs({"A": "192.0.2.1/24"})


def test_guest_isolated_and_only_explicit_access_permitted():
    assert policy_decision("visitantes", "servidores", 443)["decisao"] == "Bloquear"
    assert policy_decision("visitantes", "internet", 443)["decisao"] == "Permitir"
    assert policy_decision("interna", "servidores", 22)["decisao"] == "Bloquear"
    assert policy_decision("administracao", "servidores", 22)["decisao"] == "Permitir"
    with pytest.raises(ValueError):
        policy_decision("interna", "internet", True)

