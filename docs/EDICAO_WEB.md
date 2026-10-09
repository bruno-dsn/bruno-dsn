# Edição web · uso e contratos

## Comece sem experiência

Abra **Ler um log**, avance os quatro passos e clique nos campos do registro. Em **Investigar**, alterne entre os casos financeiro e benigno, percorra os eventos e abra as evidências pelos IDs dos sinais. Os horários são UTC.

O cartão da página inicial pode ser virado para comparar registros com perguntas. A navegação, os campos e as ações funcionam por teclado. O botão de movimento reduz as animações; a preferência de acessibilidade do sistema também é respeitada.

Em **Inventário**, use **Cadastrar ativo** e os botões **Editar**. Não sabe um estado? Marque “Não sei”. IP e portas são declarações, sem teste de conexão. O diagnóstico e o inventário alimentam **Meu plano**.

## Onde os dados ficam

O site é estático: HTML, CSS e módulos JavaScript locais, sem dependências de execução de terceiros. As únicas leituras de rede do aplicativo carregam os exemplos e o catálogo publicados na própria origem. Arquivos selecionados são lidos na memória do navegador. Não há envio de logs, notas, avaliação ou inventário para uma API, nem armazenamento desses dados em localStorage, IndexedDB ou cookies pelo aplicativo.

Fechar ou recarregar pode encerrar o trabalho. Exporte os arquivos antes de sair. O navegador e a hospedagem ainda fazem suas funções normais, como servir páginas; a afirmação de processamento local se refere aos dados selecionados e às anotações do laboratório.

A edição Streamlit é diferente: arquivos chegam ao processo Python que executa o aplicativo. Use-a localmente. Uma hospedagem compartilhada exige autenticação, autorização, isolamento de sessões, retenção e revisão próprios.

## Formato de eventos

CSV tem cabeçalho com estas dez colunas, sem repetir nem acrescentar campos. JSONL tem um objeto por linha com as mesmas chaves; todos os valores são texto, inclusive o valor financeiro.

| Campo | Contrato |
| --- | --- |
| `event_id` | Não vazio, único no arquivo |
| `timestamp` | ISO 8601: `2026-10-08T12:00:00Z` ou fuso `-03:00`; até seis casas na fração de segundo |
| `origem` | `autenticacao`, `identidade`, `financeiro` ou `rede` |
| `usuario` | Conta informada pela fonte; vazio quando desconhecida |
| `ip` | IPv4/IPv6 válido ou vazio; sem identificador de zona local |
| `sessao` | Identificador de correlação seguro ou vazio; nunca um token ativo |
| `acao` | Operação não vazia, conforme o significado na fonte |
| `resultado` | `sucesso`, `falha`, `negado` ou `informativo` |
| `recurso` | Alvo informado ou vazio; revise dados sensíveis |
| `valor_brl` | Vazio ou número não negativo com até duas casas decimais, como `15000.00`; até 1 trilhão por evento |

Limites: 2 MB, 10.000 eventos, 200 caracteres por campo. Arquivos precisam usar UTF-8. IDs repetidos, datas inválidas, fuso ausente, chaves JSON repetidas e campos extras são rejeitados. JSON tem profundidade limitada na edição web. O CSV aceita campos entre aspas, aspas duplicadas e quebras dentro de campos; a edição web rejeita aspas em posições inválidas.

O importador espera registros normalizados. Um arquivo nativo de Windows, firewall ou provedor de identidade precisa de um adaptador que preserve origem e significado dos campos; não basta renomear colunas sem entender os eventos.

## Regras de investigação

| Sinal | Critério |
| --- | --- |
| Login após falhas | Pelo menos cinco falhas da mesma conta e IP nos dez minutos anteriores a um login com sucesso |
| IP não visto no recorte | Login com sucesso em um IP diferente dos sucessos anteriores da mesma conta neste arquivo; inclui um registro de referência |
| MFA desativado | Fonte identidade informa `mfa_desativado` com sucesso |
| Transferência alta | Fonte financeiro informa `transferencia` com sucesso e valor igual ou acima do limiar escolhido |
| Alteração e transferência | Mesma conta e sessão; desativação de MFA ou alteração de favorecido antes da transferência, em até trinta minutos; exige confirmar namespace compartilhado entre fontes |

Um sinal conserva a observação, a hipótese, uma alternativa, a próxima verificação e os IDs que sustentam a pergunta. Não confirma incidente ou autoria. IP novo significa novo **nesse arquivo**, não uma primeira ocorrência no histórico completo.

Até 1.000 sinais e 50 evidências por sinal são apresentados, com contagem explícita das omissões. Os eventos e totais continuam completos. A correlação percorre eventos ordenados com janelas temporais; não cria todas as combinações entre alterações e transferências. A soma financeira usa inteiros em centavos (`int` em Python e `BigInt` no navegador).

## Continuar uma investigação

1. Exporte o caderno JSON na aba **Meu caderno**.
2. Guarde separadamente o arquivo original de eventos.
3. Em uma nova sessão, abra o mesmo arquivo original, no mesmo formato.
4. Restaure o caderno. Hash, tamanho e IDs precisam corresponder.

O esquema 1 contém nome do caso, SHA-256, tamanho, IDs ordenados, limiar, confirmação de compatibilidade de sessões e as quatro notas. Cada nota aceita até 3.000 caracteres. A restauração também recupera os parâmetros que alteram os sinais. Cadernos da versão Python 1 continuam compatíveis quando vinculados ao mesmo arquivo.

Exportar CSV produz uma cópia normalizada, com proteção contra fórmulas. Ela terá outros bytes e outro hash. Não substitui o original necessário para restaurar o caderno. Um hash identifica uma cópia; não verifica procedência, autenticidade ou cadeia de custódia.

## Diagnóstico, avaliação e inventário

O JSON da avaliação usa o esquema 1 da edição Python: `schema_version`, `cenario`, `answers`, `notes` e `assets`. Os controles são compartilhados por catálogo. “Não se aplica” exige justificativa. Se todos forem excluídos, o percentual fica sem valor.

O inventário usa dez colunas do modelo. Há até 500 ativos, com IDs únicos. Estados são `sim`, `nao` ou `desconhecido`. Portas são números de 1 a 65535 separados por vírgulas; o campo deve ficar entre aspas no CSV quando contém várias portas. Na edição web, o formulário evita esse detalhe para cadastros manuais.

O JSON da avaliação e o JSON do caderno são contratos diferentes. A interface valida cada um antes de substituir dados. Importações inválidas preservam o estado válido anterior.

## Revisão de Wi-Fi e roteador

Em **Redes**, alterne entre **Conexões e IPs**, **Wi-Fi e roteador** e **Praticar com ferramentas**. O desenho e a política de conexões são simulações. A revisão Wi-Fi registra declarações e evidências; não descobre equipamentos, conecta roteadores nem testa isolamento.

Seis controles próprios cobrem proteção da conexão, administração, atualização, visitantes, dispositivos e registros. Estados: `unknown`, `review`, `checked` e `na`. Os dois últimos exigem uma nota não vazia. As contagens não viram percentual ou pontuação de segurança. Um nome de Wi-Fi diferente e uma falha de ping não comprovam isolamento.

O JSON usa `schema_version: 1`, `kind: "netguard-wifi-review"`, `network_name`, `answers` e `notes`, com exatamente os seis IDs do catálogo. Nome: até 100 unidades UTF-16; nota: até 1.000. Limite total de 2 MB, UTF-8, chaves únicas e sem campos extras. Um arquivo de avaliação ou caderno não pode substituir essa revisão. Falhas na importação preservam a revisão anterior.

A revisão JSON pode ser restaurada nas edições web e Python. O HTML escapado permite leitura e impressão, com CSP sem scripts. Guarde esses arquivos separadamente da avaliação e do caderno. O catálogo `wifi-checklist.json` é compartilhado pelas duas edições.

As missões de ferramentas são propostas próprias com links oficiais. As ferramentas rodam fora do NetGuard e seus resultados não são importados automaticamente. Capturas PCAP do Wireshark não seguem o contrato de eventos CSV/JSONL.

## Segurança e verificação

Texto importado é escapado na interface e nos relatórios. Não é executado como HTML. Não há `eval`, comandos, sondagem ou aplicação automática de contenção. O HTML principal inclui uma política CSP que permite scripts e estilos locais; relatórios exportados têm política restrita sem scripts. A meta CSP não define políticas de framing ou cabeçalhos HTTP da hospedagem.

O relatório exportado pode conter contas, horários, valores e notas. Revise antes de compartilhar. O identificador de sessão deve ser seguro para correlação, conforme a orientação da [OWASP sobre sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), sem revelar um segredo utilizável.

`npm test` valida as regras e fluxos DOM com jsdom: navegação, filtros, notas, restauração, importação, formulário de ativos, foco e controle de movimento. `pytest` valida o motor Python e os fluxos Streamlit. DOM emulado não mede layout, contraste renderizado ou animações em um navegador real; revise desktop/mobile visualmente ao alterar o design.

## Hospedagem e manutenção

O código está em `web/`. Para servir, copie `index.html`, `styles.css`, `app.js`, `core.js`, `wifi.js`, `shield.svg` e `data/` para a raiz estática. Não publique `node_modules`, testes ou dependências de desenvolvimento. Não há etapa de build.

A versão hospedada começa com acesso privado do autor. A fonte pública no GitHub permite executar localmente. Preservar acesso privado não impede o compartilhamento de código e exemplos sintéticos.

O catálogo e os exemplos de `web/data` devem corresponder aos arquivos Python. Os testes verificam essa correspondência. Alterações nas regras precisam manter os casos financeiro e benigno e acrescentar casos que distingam falsos positivos, lacunas e correlação legítima.
