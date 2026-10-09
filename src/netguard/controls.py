"""Catálogo próprio de ações introdutórias, inspirado no NIST CSF 2.0."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Control:
    id: str
    area: str
    title: str
    question: str
    action: str
    evidence: str
    weight: int
    days: int


CONTROLS = (
    Control("gv01", "Governar", "Responsável pela segurança", "Há uma pessoa responsável por coordenar segurança e decidir prioridades?", "Definir responsável, substituto e um canal para comunicar problemas.", "Nome da função, responsabilidades e canal de contato; evite dados pessoais no exemplo.", 3, 7),
    Control("gv02", "Governar", "Regras de acesso", "A equipe conhece as regras de uso, acesso e desligamento?", "Documentar regras curtas e revisar o acesso ao mudar de função ou sair da empresa.", "Política de acesso e registro de uma revisão fictícia.", 3, 14),
    Control("gv03", "Governar", "Fornecedores críticos", "Fornecedores de e-mail, sistemas e backup têm responsável e contato de suporte registrados?", "Listar fornecedores críticos, suporte e responsabilidades na recuperação.", "Lista de fornecedores e serviços críticos.", 2, 30),
    Control("id01", "Identificar", "Inventário de ativos", "Equipamentos, serviços, contas e responsáveis estão inventariados?", "Inventariar ativos e identificar quem mantém cada serviço.", "Inventário revisado com data e responsável por função.", 4, 7),
    Control("id02", "Identificar", "Dados e serviços essenciais", "Vocês sabem quais dados e serviços a empresa precisa recuperar primeiro?", "Identificar serviços essenciais e combinar a ordem de recuperação com o negócio.", "Lista de serviços, impacto de indisponibilidade e prioridades.", 4, 7),
    Control("id03", "Identificar", "Exposição e ciclo de vida", "Serviços expostos e equipamentos sem suporte são conhecidos?", "Revisar exposição externa e planejar atualização ou substituição de equipamentos sem suporte.", "Registro da revisão de exposição e suporte; não inclua senhas.", 5, 7),
    Control("pr01", "Proteger", "MFA nas contas críticas", "E-mail, acesso remoto e contas administrativas usam autenticação multifator?", "Habilitar MFA nas contas críticas, preferindo opções resistentes a phishing quando disponíveis.", "Checklist de MFA por serviço e procedimento de recuperação de acesso.", 5, 7),
    Control("pr02", "Proteger", "Contas individuais e privilégios", "As contas são individuais, com privilégios limitados ao trabalho de cada pessoa?", "Eliminar contas compartilhadas quando possível e separar contas administrativas das de uso diário.", "Matriz de acesso revisada e procedimento de desligamento.", 4, 14),
    Control("pr03", "Proteger", "Atualizações e proteção dos dispositivos", "Sistemas e dispositivos recebem atualizações e a proteção dos endpoints é acompanhada?", "Definir uma rotina de atualização, priorizando correções relevantes para os ativos expostos.", "Calendário de atualização e relatório de cobertura dos dispositivos.", 5, 7),
    Control("pr04", "Proteger", "Separação de redes", "Visitantes e dispositivos IoT ficam separados dos serviços internos?", "Planejar redes separadas e validar regras de acesso entre elas com a equipe responsável.", "Mapa de redes e teste controlado das regras; VLAN sozinha não prova isolamento.", 4, 14),
    Control("pr05", "Proteger", "Senhas e phishing", "A equipe usa senhas únicas e sabe como comunicar mensagens suspeitas?", "Adotar um gerenciador de senhas adequado e orientar a equipe sobre como reportar suspeitas.", "Orientação curta e um exercício fictício de comunicação.", 3, 14),
    Control("de01", "Detectar", "Logs essenciais", "Autenticação e ações administrativas deixam registros que alguém consegue consultar?", "Identificar fontes de logs, acesso autorizado e prazo de retenção compatível com as necessidades.", "Lista de fontes de logs e amostra fictícia de consulta.", 3, 14),
    Control("de02", "Detectar", "Alertas e triagem", "Há um responsável por analisar alertas de acesso e mudanças suspeitas?", "Definir alertas iniciais e um roteiro de triagem para separar sinais de incidentes confirmados.", "Roteiro de triagem com hipótese, evidência e encaminhamento.", 3, 14),
    Control("rs01", "Responder", "Plano de incidente", "A equipe sabe quem acionar e como preservar evidências diante de um incidente?", "Escrever um plano curto de acionamento, preservação de evidências e comunicação.", "Plano de resposta e contatos por função.", 4, 7),
    Control("rs02", "Responder", "Exercício de resposta", "O plano já foi exercitado em um cenário fictício?", "Realizar um exercício de mesa com um incidente fictício e registrar o que precisa mudar.", "Registro do exercício e ações de melhoria.", 2, 30),
    Control("rc01", "Recuperar", "Backup isolado", "Os dados essenciais têm cópias protegidas contra a perda do ambiente principal?", "Planejar cópias com acesso separado e proteção contra alteração, conforme o ambiente.", "Mapa de cópias, frequência e controle de acesso.", 5, 7),
    Control("rc02", "Recuperar", "Teste de restauração", "A restauração de um dado ou serviço essencial foi testada?", "Restaurar uma cópia em ambiente de teste e verificar integridade e tempo necessário.", "Registro do teste, resultado e problemas encontrados.", 5, 7),
    Control("rc03", "Recuperar", "Continuidade e melhoria", "Há uma alternativa para trabalhar durante a indisponibilidade e uma revisão após a recuperação?", "Definir alternativas para serviços críticos e revisar as lições após o exercício ou incidente.", "Plano de continuidade e registro de lições aprendidas.", 3, 30),
)

BY_ID = {control.id: control for control in CONTROLS}
STATUS_LABELS = {
    "unknown": "Não sei",
    "absent": "Não implementado",
    "partial": "Parcial",
    "implemented": "Implementado",
    "na": "Não se aplica",
}
