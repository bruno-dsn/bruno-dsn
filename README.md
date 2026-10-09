# Rede em Movimento

[**Abrir a prévia — acesso privado do autor**](https://rede-em-movimento.brdsnunes.chatgpt.site) · [**Código público**](https://github.com/bruno-dsn/bruno-dsn/tree/rede-em-movimento) · [**Baixar o ZIP**](https://github.com/bruno-dsn/bruno-dsn/archive/refs/heads/rede-em-movimento.zip) · [**Ponto de retomada**](https://github.com/bruno-dsn/bruno-dsn/blob/netguard-lab/docs/CONTINUIDADE.md)

O código está na branch `rede-em-movimento` do repositório de perfil `bruno-dsn/bruno-dsn`. A criação de um repositório independente continua pendente. A prévia está online para o autor; os colegas podem estudar o código e executar a edição local.

**Uma reciclagem de redes para aprender construindo.** Projeto de Bruno Nunes, separado do NetGuard Lab.

A primeira versão transforma o caminho de uma requisição ao abrir um site em uma aula animada de 12 etapas. Você pausa, volta, muda a velocidade e explora sete camadas OSI com desenhos próprios. Depois quebra uma pequena rede, ajusta as configurações e registra o que aprendeu.

## O que funciona nesta versão

- Aula de DNS, enlace, IP, abertura TCP, TLS e HTTP, em um cenário fictício.
- Navegação manual e reprodução por etapas; modo de movimento reduzido, teclado e descrições dos desenhos.
- Explicações das sete camadas OSI, com funções, ilustrações e tarefas.
- Missões de cabo desconectado, computadores em sub-redes distintas, gateway errado, DNS errado e serviço indisponível.
- Comparação entre comunicação local, caminho remoto e acesso ao site pelo nome.
- Caderno de três notas com exportação/restauração JSON e relatório HTML.

As animações são ilustrações, não uma captura real nem um vídeo exportado. O modelo OSI organiza funções; a pilha TCP/IP não apresenta obrigatoriamente protocolos separados de sessão e apresentação. TLS não é classificado rigidamente como camada 6.

## Estudar em dez minutos

1. Abra **Aula animada** e acompanhe o caminho. Pause antes do SYN e explique o que o DNS já resolveu.
2. Em **Camadas OSI**, explore transporte, rede e enlace. Compare endereços IP e MAC.
3. Em **Construir e corrigir**, escolha **Trocar gateway** e **Testar no modelo**. Compare o acesso local e o remoto.
4. Corrija o gateway para `192.0.2.1` e teste novamente.
5. Escolha **Trocar DNS**. Explique por que a falha é diferente.
6. Exporte **Meu caderno** e repita a topologia no Packet Tracer para comparar com uma simulação mais completa.

## Executar localmente

Python disponível, sem instalar pacotes para a aplicação:

```bash
python -m http.server 8000 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8000`. Use um navegador atual com módulos ES. Abrir por `file://` não é suportado.

Para testes de regras e fluxos DOM, use o Node indicado em `package.json`:

```bash
npm ci --ignore-scripts
npm test
```

Para empacotar os arquivos estáticos: `npm run build`. Publique somente `dist/`, sem dependências de desenvolvimento.

## Limites do exercício

A máscara é sempre /24. O roteador tem `192.0.2.1/24`, o DNS `198.51.100.53` e o servidor web `203.0.113.80`. São endereços de documentação. Os cenários têm nome fictício e não fazem sondagens de rede.

O modelo não implementa DHCP, ARP, NAT, IPv6, VLANs, firewall ou o estado completo de TCP/TLS. A animação assume endereços e rotas configurados, MAC do gateway conhecido, DNS sem resposta em cache e HTTPS sobre TCP. HTTP/3/QUIC terá outro caminho de estudo. A negociação TLS e a resposta HTTP podem resumir vários pacotes numa cena.

O teste local considera uma LAN sem rota adicional entre os computadores. Alterar o computador B não impede, sozinho, o computador A de usar o site. Um diagnóstico do modelo não verifica equipamentos reais.

## Caderno e segurança

As notas e configurações ficam na memória da página, sem envio ao servidor, localStorage ou IndexedDB. Exporte antes de fechar ou recarregar. JSON tem esquema 1, tipo próprio, campos exatos, limite de 2 MB, chaves únicas e notas de até 2.000 unidades UTF-16. Uma importação inválida preserva o caderno anterior.

A configuração pode estar errada no cenário, mas precisa ter IPv4s com sintaxe válida para exportar. Textos são escapados na interface e nos relatórios, que têm política CSP sem scripts. Não há captura de pacotes ou execução de comandos.

## Próximos módulos

- DHCP e ARP, com eventos visíveis e cache.
- Sub-redes com prefixos variáveis, IPv6 e planejamento.
- VLANs, roteamento e regras entre redes.
- Arquivos de laboratório Packet Tracer e exercícios com capturas de exemplo no Wireshark.

São propostas futuras, não funções já implementadas. A inspeção visual em navegador precisa ser registrada separadamente dos testes DOM.

## Referências

Os textos, desenhos e cenários são próprios. As referências técnicas são [ITU X.200](https://www.itu.int/rec/T-REC-X.200-199407-I/en), [RFC 1122](https://www.rfc-editor.org/info/rfc1122/), [RFC 9293](https://www.rfc-editor.org/info/rfc9293/), [RFC 1034](https://www.rfc-editor.org/info/rfc1034/) e [RFC 9846](https://www.rfc-editor.org/info/rfc9846/). Para praticar fora deste aplicativo: [Cisco Packet Tracer](https://www.netacad.com/learning-collections/cisco-packet-tracer).

Licença MIT. Este projeto não é afiliado à Cisco, à ITU ou à IETF.
