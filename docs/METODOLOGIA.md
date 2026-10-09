# Como interpretar o diagnóstico

O catálogo tem 18 controles próprios, distribuídos pelas seis funções do NIST CSF 2.0: Governar, Identificar, Proteger, Detectar, Responder e Recuperar. O mapeamento organiza o estudo; não reproduz uma avaliação oficial ou todas as subcategorias do framework.

O **atendimento declarado** é uma média ponderada das respostas. Os pesos, entre 2 e 5, são escolhas educacionais do projeto. Implementado vale 1; parcial vale 0,5; não implementado e não sei valem 0. Não se aplica exige justificativa e sai do denominador. Se todos os controles forem excluídos, não há percentual.

A falta de informação permanece visível no contador **Ainda não sabemos**. Ela gera uma tarefa para confirmar o estado, sem afirmar que existe uma vulnerabilidade. Um controle implementado sem nota gera uma tarefa de reunir evidências. As notas são fornecidas pelo usuário e não são verificadas automaticamente.

As tarefas de inventário usam regras separadas. Por exemplo, uma exposição declarada de RDP ou SMB recebe atenção urgente; uma porta 443 exposta, sozinha, não produz esse alerta. Não há detecção da exposição por rede, verificação de versão ou consulta a bases de vulnerabilidades.

O plano ordena peso, prazo sugerido e nome do item. Prazos de 7, 14 ou 30 dias são sugestões para negociar com a equipe, não uma obrigação legal ou uma estimativa exata de esforço. Antes de uma alteração, confira dependências, continuidade e possibilidade de retorno.

O percentual não representa chance de invasão, proteção garantida, conformidade ou certificação. Também não substitui uma análise profissional do ambiente. O relatório distingue declarações, informações desconhecidas e próximos passos.

Referências: [NIST SP 1300](https://www.nist.gov/publications/nist-cybersecurity-framework-20-small-business-quick-start-guide), publicado em 2024, e [CISA Secure Our World](https://www.cisa.gov/secure-our-world). O catálogo, os pesos e os exemplos foram escritos para este projeto, sem afiliação a essas instituições.
