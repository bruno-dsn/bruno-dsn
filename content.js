export const LAYERS = [
 {id:7,name:'Aplicação',unit:'Dados',role:'Oferece funções de comunicação aos processos da aplicação.',example:'HTTP e DNS ajudam a solicitar recursos e resolver nomes.',practice:'Explique a diferença entre consultar um nome e pedir uma página.'},
 {id:6,name:'Apresentação',unit:'Representação',role:'Cuida da representação e transformação dos dados trocados.',example:'O texto “Olá” pode ser representado como bytes UTF-8.',practice:'Compare o texto com os bytes: 4F 6C C3 A1.'},
 {id:5,name:'Sessão',unit:'Diálogo',role:'Organiza o diálogo e pontos de sincronização entre aplicações.',example:'Pense em coordenar uma troca e um ponto de retomada.',practice:'Descreva como uma aplicação saberia onde continuar uma troca interrompida.'},
 {id:4,name:'Transporte',unit:'Segmento / datagrama',role:'Fornece comunicação entre sistemas finais para as aplicações.',example:'TCP e UDP oferecem comportamentos diferentes; portas ajudam a identificar serviços.',practice:'Localize SYN, SYN+ACK e ACK na aula animada.'},
 {id:3,name:'Rede',unit:'Pacote',role:'Trata endereçamento e encaminhamento entre redes.',example:'IP e roteadores participam do caminho até outra rede.',practice:'Mude o gateway no laboratório e observe a diferença entre acesso local e remoto.'},
 {id:2,name:'Enlace',unit:'Quadro',role:'Organiza a transferência pelo enlace entre dispositivos.',example:'Ethernet usa quadros com endereços MAC em cada enlace.',practice:'Identifique qual conexão local liga o computador ao switch.'},
 {id:1,name:'Física',unit:'Sinais / bits',role:'Transporta bits pelo meio físico.',example:'Sinais elétricos, ópticos ou de rádio representam bits.',practice:'Desconecte o cabo do computador no exercício e veja o que para de funcionar.'}
];
export const STEPS = [
 {title:'Tudo começa com um endereço.',layer:7,path:'',body:'Você digita https://loja.example. O navegador precisa descobrir aonde conectar antes de solicitar a página.',packet:'Nome: loja.example',question:'Nome de site e endereço IP são a mesma coisa?'},
 {title:'O computador consulta o DNS.',layer:7,path:'pc-dns',body:'Neste cenário, uma consulta DNS por UDP pergunta o IPv4 de loja.example ao servidor 198.51.100.53.',packet:'DNS · UDP 53 · destino 198.51.100.53',question:'Qual serviço traduz o nome para um endereço?'},
 {title:'Dados recebem informações de transporte.',layer:4,path:'',body:'A consulta entra em um datagrama UDP e em um pacote IPv4. Um quadro Ethernet leva o pacote no enlace local.',packet:'Ethernet [ IPv4 [ UDP [ DNS ] ] ]',question:'O que muda quando você olha o quadro por dentro?'},
 {title:'O enlace leva os sinais ao próximo salto.',layer:1,path:'pc-router',body:'O quadro segue pelo switch até o gateway. Assumimos que o endereço MAC do gateway já foi obtido por ARP.',packet:'Próximo salto: gateway 192.0.2.1',question:'Para chegar a outra rede, o computador envia primeiro para quem?'},
 {title:'O roteador encaminha o pacote.',layer:3,path:'router-dns',body:'O roteador consulta a rota e encaminha o pacote. O quadro do enlace seguinte é diferente; o exemplo não usa NAT.',packet:'IPv4 destino: 198.51.100.53',question:'Por que o quadro muda de um enlace para o outro?'},
 {title:'O DNS responde com o endereço.',layer:7,path:'dns-pc',body:'A resposta informa 203.0.113.80 para o nome fictício. Agora o navegador conhece o endereço do servidor deste exercício.',packet:'Resposta DNS: loja.example → 203.0.113.80',question:'Uma resposta DNS já contém a página inteira?'},
 {title:'TCP: o cliente envia SYN.',layer:4,path:'pc-web',body:'Escolhemos HTTPS sobre TCP. O cliente inicia uma conexão com a porta 443 do servidor.',packet:'TCP · SYN · porta de destino 443',question:'Esse primeiro segmento já é o pedido HTTP?'},
 {title:'TCP: o servidor responde SYN+ACK.',layer:4,path:'web-pc',body:'O servidor responde ao pedido de conexão e informa seus próprios parâmetros de sequência.',packet:'TCP · SYN + ACK',question:'Qual direção você vê agora no desenho?'},
 {title:'TCP: o cliente confirma com ACK.',layer:4,path:'pc-web',body:'O cliente confirma. O modelo mostra a abertura básica, sem perdas, retransmissões ou conexão simultânea.',packet:'TCP · ACK',question:'Por que uma confirmação importa numa conversa confiável?'},
 {title:'TLS prepara a comunicação protegida.',layer:6,path:'pc-web',body:'A negociação envolve várias mensagens. O cliente verifica a identidade do servidor e os participantes estabelecem proteção para os dados.',packet:'TLS · negociação ilustrada em uma etapa',question:'Que informação precisa ser conferida antes de confiar na identidade do servidor?'},
 {title:'A aplicação pede a página.',layer:7,path:'pc-web',body:'O navegador envia o pedido HTTP protegido por TLS. Aqui mostramos o significado na aplicação, não conteúdo legível numa captura sem as chaves.',packet:'HTTP → TLS → TCP → IPv4 → enlace',question:'Um observador do tráfego vê automaticamente o conteúdo de HTTPS?'},
 {title:'O conteúdo retorna ao navegador.',layer:7,path:'web-pc',body:'O servidor responde e o navegador interpreta o conteúdo recebido. A animação comprime vários pacotes em uma cena para facilitar o estudo.',packet:'Resposta HTTP protegida → navegador',question:'Qual foi o papel de DNS, IP, TCP e HTTP no caminho?'}
];
export const PATHS = {
 'pc-dns':'M100 230 L300 230 L500 230 L755 105',
 'dns-pc':'M755 105 L500 230 L300 230 L100 230',
 'pc-router':'M100 230 L300 230 L500 230',
 'router-dns':'M500 230 L755 105',
 'pc-web':'M100 230 L300 230 L500 230 L755 355',
 'web-pc':'M755 355 L500 230 L300 230 L100 230'
};
export const REFERENCES = [
 ['Modelo OSI — ITU X.200','https://www.itu.int/rec/T-REC-X.200-199407-I/en'],
 ['Arquitetura TCP/IP — RFC 1122','https://www.rfc-editor.org/info/rfc1122/'],
 ['TCP — RFC 9293','https://www.rfc-editor.org/info/rfc9293/'],
 ['DNS — RFC 1034','https://www.rfc-editor.org/info/rfc1034/'],
 ['TLS 1.3 — RFC 9846','https://www.rfc-editor.org/info/rfc9846/'],
 ['Praticar no Cisco Packet Tracer','https://www.netacad.com/learning-collections/cisco-packet-tracer']
];
