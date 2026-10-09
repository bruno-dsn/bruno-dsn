# Investigue um relato de fraude sem pular etapas

Um log é um registro de algo que um sistema informou: uma tentativa de acesso, uma alteração de conta, uma conexão ou uma operação. Um evento pode ajudar a reconstruir uma sequência; nem sempre informa intenção, autoria ou o resultado externo da operação.

## O caso fictício

A equipe financeira de uma loja de exemplo relatou duas transferências não reconhecidas. O arquivo reúne registros fictícios de autenticação, identidade, rede e financeiro. Os sistemas do exemplo usam o mesmo identificador de sessão; isso é uma premissa explícita do caso, que precisaria ser confirmada em um ambiente real.

A pergunta inicial é: quais eventos ajudam a explicar o relato, quais explicações alternativas existem e o que precisamos confirmar antes de decidir a contenção?

## Passo a passo

1. **Delimite o relato.** Registre quando foi percebido, qual conta ou serviço está envolvido e o que a equipe considera não reconhecido. O log de sucesso não comprova que o banco liquidou o pagamento.
2. **Preserve os registros.** Trabalhe com cópias e registre origem, período, fuso e responsável pela coleta. O aplicativo mostra SHA-256 dos bytes recebidos, que identifica aquele arquivo; um hash isolado não comprova a autenticidade ou a integridade histórica do log.
3. **Monte a linha do tempo.** O laboratório normaliza horários para UTC e preserva IDs. Confira relógios, fusos e lacunas. Ordem cronológica não prova relação de causa.
4. **Correlacione com critério.** Confira conta, sessão, recurso e intervalo. O mesmo IP pode ser compartilhado por pessoas diferentes. Os IDs de sessão só podem ser unidos entre sistemas quando sua origem e namespace forem compatíveis.
5. **Separe observação e hipótese.** Uma alteração de MFA registrada é observação. Uso indevido da conta é uma hipótese. Recuperação autorizada de acesso é uma explicação alternativa a verificar.
6. **Defina a próxima verificação.** Confira autorizações, registros do provedor, favorecido, dispositivo e confirmação por canais conhecidos. Anote também o que falta no arquivo.
7. **Planeje a contenção com a equipe.** Dependendo do que for confirmado, podem ser necessários revogar sessões, proteger a conta, restringir um serviço exposto ou interromper operações suspeitas pelos canais oficiais. Registre responsáveis e preserve evidências; o laboratório não executa essas ações.

## Porta de entrada: uma pergunta a testar

O inventário do exemplo declara RDP exposto. O arquivo também contém um registro de conexão em rede. Esses itens justificam verificar a configuração e a origem, mas não estabelecem que a fraude entrou por RDP. O caso também tem eventos de acesso à conta e alteração de MFA. A investigação precisa distinguir acesso remoto, uso indevido de identidade, engenharia social e operação autorizada antes de atribuir uma causa.

## Regras do laboratório

| Sinal | O que dispara | O que ainda falta confirmar |
| --- | --- | --- |
| Login após falhas | Cinco falhas da mesma conta e IP, seguidas de sucesso em dez minutos | Legitimidade, dispositivo e contexto |
| Origem nova no recorte | IP de um sucesso diferente dos sucessos anteriores da conta neste arquivo | Histórico completo, VPN e mobilidade |
| MFA desativado | Evento de alteração de MFA com sucesso | Aprovação e identidade do responsável |
| Transferência alta | Valor registrado acima do limiar escolhido | Rotina, aprovação e liquidação financeira |
| Alteração e transferência | Alteração e transferência com a mesma sessão em até trinta minutos | Compatibilidade dos IDs e autorização |

Os pesos e limiares são escolhas próprias para estudo. O projeto não usa IA para acusar uma pessoa nem confirma invasão. O caso benigno mostra como esquecimento de senha e operação legítima também podem gerar sinais.

## Caderno da investigação

Escreva observações com IDs dos eventos, hipóteses, explicações alternativas, perguntas pendentes e ações propostas. Exporte seu caderno. Para apresentar no portfólio, explique uma hipótese que os dados apoiam e outra que eles não permitem concluir.

Referências para aprofundar: [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), sobre resposta a incidentes, e [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final), sobre gestão de logs. O caso, o arquivo e as regras são próprios e fictícios.
