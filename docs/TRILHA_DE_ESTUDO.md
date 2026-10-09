## Quatro semanas para experimentar a área

O objetivo é produzir evidências de aprendizado e descobrir quais tarefas você gosta de fazer. Ajuste a duração ao seu tempo disponível.

| Semana | Estudo e prática | Entrega |
| --- | --- | --- |
| 1 | Revise IPv4, IPv6, CIDR, DNS, DHCP, roteamento e NAT. Use a calculadora e explique /24, /31 e /32. | Mapa de uma empresa fictícia com redes e serviços identificados |
| 2 | Estude VLANs, regras de acesso, MFA, contas administrativas e atualização de equipamentos. Teste a política didática. | Tabela de acessos necessários, bloqueios esperados e testes de isolamento |
| 3 | Estude fontes de logs, janela temporal e falsos positivos. Altere os parâmetros do laboratório. | Relato de dois sinais: hipótese, evidência disponível e pergunta que falta responder |
| 4 | Faça o diagnóstico, teste uma restauração em um ambiente de estudo e simule um incidente em uma conversa de mesa. | Plano de ação revisado, relatório e uma explicação de cinco minutos |

## Seu primeiro caso

Uma loja fictícia usa computadores de atendimento, Wi-Fi de visitantes, um servidor e e-mail em nuvem. O inventário informa um acesso remoto exposto e restauração não testada. Algumas informações estão desconhecidas.

Explique três prioridades, incluindo uma que exija confirmar informação. Proponha um mapa de redes sem sobreposição e mostre quais conexões seriam necessárias. Registre como testar uma mudança sem interromper o funcionamento da loja.

## Como juntar isso com IA e dados

A análise de logs usa uma regra simples e explicável. Uma próxima experiência possível é comparar essa referência com detecção de anomalias, usando conjuntos de treino e avaliação separados no tempo. Antes de chamar um resultado de melhoria, meça falsos positivos, eventos relevantes encontrados, volume de alertas e custo de investigar.

Dados sintéticos ajudam a verificar o funcionamento, mas não demonstram eficácia em uma empresa real. Conte quais hipóteses o gerador usa e quais tipos de incidente não aparecem nele.

## Recursos de referência

- [NIST Small Business Cybersecurity Corner](https://www.nist.gov/itl/smallbusinesscyber): referências para organizar risco e estudar proteção de pequenos negócios.
- [CISA Secure Our World](https://www.cisa.gov/secure-our-world): práticas introdutórias sobre phishing, senhas, MFA e atualização.
- [Cisco Networking Academy](https://www.netacad.com/): consulte a oferta atual de cursos de redes e cibersegurança e os requisitos de cada laboratório.

## Registre seu aprendizado

Para cada exercício, escreva o problema, a hipótese, o que você executou, o resultado e o que não conseguiu validar. Um teste que falha e leva a uma correção pode ser uma boa evidência, desde que você consiga explicar a causa.

## Quatro primeiras ferramentas, com uma entrega por vez

1. **[Cisco Packet Tracer](https://www.netacad.com/learning-collections/cisco-packet-tracer):** monte dois computadores e um switch, escolha endereços na mesma sub-rede e acompanhe um ping no modo Simulation. Mude a sub-rede de um computador e explique por que o caminho falhou. Guarde a topologia e sua explicação.
2. **[Wireshark](https://www.wireshark.org/docs/wsug_html/):** abra uma [captura de exemplo](https://wiki.wireshark.org/SampleCaptures) que contenha DNS; use `dns` e compare consulta e resposta. Em outras capturas, explore `arp` e `tcp`. Explique dois pacotes. PCAP não é um arquivo de eventos do NetGuard.
3. **[Nmap](https://nmap.org/book/man.html):** em uma máquina de laboratório sua ou autorizada, compare serviços esperados e portas observadas. Consulte `open`, `closed` e `filtered` no manual. Um serviço acessível não confirma invasão. Guarde uma tabela com pergunta e próxima verificação.
4. **[Wazuh](https://documentation.wazuh.com/current/getting-started/index.html):** depois da base, monte um laboratório seguindo os requisitos oficiais, com agente e componentes centrais. Observe uma alteração controlada em arquivo monitorado; explique evento, regra e contexto.

Essas são sugestões de sequência do NetGuard, não um currículo oficial das ferramentas. Comece pelas duas primeiras e avance quando conseguir explicar o exercício. A área **Redes → Praticar com ferramentas** resume as missões nas duas edições.

## Uma revisão pequena da sua rede

Use **Redes → Wi-Fi e roteador**. Registre o que foi consultado, com responsável, data e uma referência. Para visitantes, planeje com o administrador um teste de acesso permitido à internet e um teste de bloqueio de um serviço interno conhecido. Uma falha de ping pode ter outra causa. Exporte a revisão antes de encerrar e reveja após mudanças.
