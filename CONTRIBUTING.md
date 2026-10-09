# Contribuir

Explique o problema, a mudança de comportamento e como verificou o resultado. Para regras de logs, inclua uma explicação alternativa e um exemplo legítimo que ajude a avaliar falsos positivos.

Execute `python -m ruff check .` e `python -m pytest` após instalar `requirements-dev.txt`. Mantenha as regras em `src/netguard` independentes do Streamlit. Atualize os contratos e exemplos quando mudar uma entrada ou exportação.

Use dados fictícios e preserve IDs, fusos e precisão financeira nos testes. Novas correlações entre sistemas devem declarar as premissas de identidade e sessão. Uma hipótese não deve aparecer como confirmação de incidente.
