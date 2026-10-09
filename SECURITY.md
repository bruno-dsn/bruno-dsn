# Uso e comunicação de problemas

A versão 2 oferece um laboratório estático no navegador e uma edição Python local. Os exemplos usam pessoas, empresas, ativos e operações fictícios. Não há sondagem de rede, acesso a contas, alteração de firewall ou integração bancária.

O upload aceita apenas os contratos documentados, com limites de tamanho e quantidade de registros. Exportações HTML escapam texto e exportações CSV protegem células de texto que poderiam iniciar fórmulas. Isso não substitui autenticação, controle de acesso e uma revisão própria se o aplicativo for adaptado para vários usuários ou dados de uma empresa.

Na edição web, arquivos e notas ficam na memória da página, sem API de upload, coleta ou persistência pelo aplicativo. A meta CSP restringe scripts e estilos a arquivos locais. Ela não configura cabeçalhos HTTP ou bloqueio de framing na hospedagem. No Streamlit, o upload chega ao processo Python; use o endereço local recomendado. Leia as diferenças em [EDICAO_WEB.md](docs/EDICAO_WEB.md).

A investigação conserva os IDs e calcula SHA-256 dos bytes recebidos. Esse hash não comprova procedência nem cadeia de custódia. Restauração do caderno exige o mesmo hash, tamanho e lista de IDs. Até 1.000 sinais e 50 evidências por sinal são apresentados, com indicação das omissões; o recorte e os totais ficam completos. Um sinal não confirma invasão, autoria ou prejuízo.

Para demonstrar, use os exemplos. Registros reais exigem autorização e minimização dos dados. Nunca importe senhas, tokens ativos, cookies de sessão ou segredos. Em `sessao`, use um identificador de correlação seguro. Não publique informação financeira real em commits ou issues. Arquivos exportados podem conter os dados e notas informados; revise-os antes de compartilhar.

Comunique uma falha com uma descrição e uma reprodução mínima usando dados fictícios. Se o problema expuser informação sensível, use o contato disponível no [perfil do autor](https://github.com/bruno-dsn) antes de abrir uma issue pública.
