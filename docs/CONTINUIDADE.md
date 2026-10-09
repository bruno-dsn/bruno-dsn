# Ponto de retomada

Atualizado em **09/10/2026**, depois das publicações. O código e este registro estão salvos no GitHub. Ao retomar, leia a versão mais recente e confira os commits antes de refazer uma etapa; o trabalho não depende do checkout da sessão anterior.

## Onde abrir

| Entrega | Aplicação ou perfil | Código | Acesso |
| --- | --- | --- | --- |
| NetGuard Lab 2.1 | [Abrir o NetGuard](https://netguard-lab.brdsnunes.chatgpt.site) | [Branch netguard-lab](https://github.com/bruno-dsn/bruno-dsn/tree/netguard-lab) | Aplicação e código públicos, para Bruno e colegas |
| Rede em Movimento 1.0 | [Abrir a prévia do autor](https://rede-em-movimento.brdsnunes.chatgpt.site) | [Branch rede-em-movimento](https://github.com/bruno-dsn/bruno-dsn/tree/rede-em-movimento) | Prévia privada do autor; código público para execução local |
| Perfil Green Hat | [Perfil de Bruno](https://github.com/bruno-dsn) | [README na branch main](https://github.com/bruno-dsn/bruno-dsn/blob/main/README.md) | Público |

**Importante para encontrar os projetos:** os dois códigos estão em branches diferentes do repositório de perfil `bruno-dsn/bruno-dsn`. Ainda não existem repositórios independentes chamados `netguard-lab` e `rede-em-movimento`, portanto não aparecem como dois itens na aba Repositories. Os links do perfil levam diretamente a cada projeto. O projeto de redes está separado do código do NetGuard.

## Entregue e verificado

### NetGuard Lab 2.1

- Mantém diagnóstico de 18 controles, inventário, exercícios de IP e acesso, leitura de logs, linha do tempo, hipóteses, caderno e plano.
- Acrescenta seis revisões guiadas de Wi-Fi e roteador: proteção da conexão, administração, atualizações, isolamento de visitantes, dispositivos e registros. Declarações conferidas ou não aplicáveis exigem evidência ou justificativa.
- A revisão de Wi-Fi tem exportação/restauração JSON e relatório HTML próprios, nas edições web e Python. Não se mistura ao caderno de logs nem à avaliação dos 18 controles.
- A área Redes inclui quatro missões iniciais de Packet Tracer, Wireshark, Nmap e Wazuh, com referências oficiais.
- **92 testes Python e 47 testes web passaram**, assim como Ruff e a verificação de intercâmbio JSON Python → web → Python.
- [CI da implementação](https://github.com/bruno-dsn/bruno-dsn/actions/runs/37994466164): concluída com sucesso para o commit [`d09e87bc`](https://github.com/bruno-dsn/bruno-dsn/commit/d09e87bc8b11d68dd16b0906c3c6e0d0394024c4).
- A publicação da versão 2.1 foi concluída com sucesso. O acesso público foi confirmado após a publicação.

### Perfil Green Hat

- Banner SVG próprio: terminal verde, chapéu e elementos de rede. A prévia rasterizada foi inspecionada visualmente.
- README com formação em Redes de Computadores desde 2017, estudo atual de IA/ML e aprendizagem prática em segurança. Sem declarar experiência profissional em redes ou segurança.
- Links destacados para os dois laboratórios, código e ZIP; preserva os demais projetos e referências de estudo.
- [Atualização dos links](https://github.com/bruno-dsn/bruno-dsn/commit/4f72c6d49d562b51c41664d2f5fd436a71eeb528), depois do [tema visual](https://github.com/bruno-dsn/bruno-dsn/commit/9a9a66465957221f6dfc98d3ca91fcae8ca92db4).

### Rede em Movimento 1.0

- Projeto separado, com fonte e publicação próprias.
- Aula “O que acontece quando abro um site?” em **12 etapas**, com pausa, retorno, velocidade e opção de reduzir movimento.
- Sete camadas OSI, cada uma com desenho, função, exemplo e tarefa. Explica a relação com TCP/IP e as simplificações da animação.
- Prática com cabo desconectado, sub-redes distintas, gateway errado, DNS errado e serviço indisponível. Os resultados distinguem comunicação local, caminho remoto e acesso pelo nome.
- Caderno de estudo na memória, com exportação/restauração JSON validada e relatório HTML.
- **20 testes de regras e interface DOM passaram**. [CI da implementação](https://github.com/bruno-dsn/bruno-dsn/actions/runs/37996296863): concluída com sucesso para o commit [`ce7438d0`](https://github.com/bruno-dsn/bruno-dsn/commit/ce7438d0aa0e5cd62d51618fd10b013594d88ebc).
- A primeira publicação foi concluída com sucesso. A prévia mantém acesso privado do autor; nenhum convite foi enviado. [README com links publicados](https://github.com/bruno-dsn/bruno-dsn/commit/544244de7aa9fff3827542fa67107ecd0c669623).

As duas aplicações web usam arquivos estáticos próprios. Dados selecionados e notas ficam na memória do navegador; Bruno deve exportar antes de fechar ou recarregar. Os exercícios são modelos de aprendizagem, não testes de uma rede real nem comprovação de invasão.

## Pendências para continuar

1. **Criar os repositórios independentes** `bruno-dsn/netguard-lab` e `bruno-dsn/rede-em-movimento`. O conector atual permite editar arquivos, commits e branches, mas não oferece criação de repositórios. O uso do GitHub pelo navegador como alternativa precisa ser aprovado antes de iniciar esse caminho. Preservar as branches existentes até confirmar a migração; depois atualizar os links do perfil e deste save.
2. **Inspeção visual das aplicações em navegador:** conferir desktop e celular, contraste renderizado, foco e animações SVG. Os testes DOM passaram, mas não substituem essa inspeção. Não declarar que ela já ocorreu.
3. **Próximo módulo do Rede em Movimento:** DHCP e ARP com eventos e cache visíveis. Depois considerar prefixos variáveis, IPv6, VLANs, roteamento, laboratório Packet Tracer e capturas de exemplo do Wireshark. São propostas, não funções entregues.
4. **NetGuard:** continuar a trilha de investigação com casos adicionais e evidências que distingam atividades legítimas, falsos positivos e lacunas de registro. Manter linguagem simples e evitar conclusões que os dados não sustentam.

## Pedido e autorização de Bruno

Bruno pediu para continuar o trabalho, manter um save, atualizar o perfil com tema hacker/Green Hat, disponibilizar o NetGuard para os colegas e criar em seguida um laboratório separado de redes. As edições de código e do perfil e a publicação pública do NetGuard já foram autorizadas. Preservar a visibilidade da prévia de redes até haver pedido para alterá-la.

## Como retomar

Quando Bruno disser **“pode continuar do save”**, abra este arquivo na branch `netguard-lab`, leia o perfil e os READMEs dos dois projetos e confira os heads das branches. Preserve o que está concluído e avance pelas pendências. Se a criação dos repositórios pelo navegador for autorizada, comece por ela. Não dependa de arquivos locais nem exponha credenciais no código ou na documentação.
