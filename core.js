import { strictJSON } from './json.js';
import { STEPS } from './content.js';
export const escapeHTML = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const DEFAULT_CONFIG = () => ({client:'192.0.2.10',peer:'192.0.2.20',gateway:'192.0.2.1',dns:'198.51.100.53',cable:true,service:true});
export function ipv4(value) {
 if(typeof value!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(value))throw new Error('Use um IPv4 completo, como 192.0.2.10.');
 const octets=value.split('.');
 if(octets.some(v=>Number(v)>255||! /^(0|[1-9]\d{0,2})$/.test(v)))throw new Error('IPv4 inválido: octetos de 0 a 255, sem zeros extras.');
 return octets.map(Number);
}
const network=octets=>octets.slice(0,3).join('.');
const host=octets=>octets[3]>0&&octets[3]<255;
export function evaluate(config) {
 const issues=[]; const add=(id,layer,title,help)=>issues.push({id,layer,title,help});
 if(!config.cable)add('cable',1,'O cabo do computador está desconectado.','Reconecte o meio físico antes de investigar serviços.');
 const addresses={};
 for(const key of ['client','peer','gateway','dns'])try{addresses[key]=ipv4(config[key]);}catch(error){add('address-'+key,3,'Confira o IPv4 de '+({client:'computador A',peer:'computador B',gateway:'gateway',dns:'DNS'}[key])+'.',error.message);}
 const {client,peer,gateway,dns}=addresses;
 const clientOK=!!client&&host(client),peerOK=!!peer&&host(peer);
 const duplicates=config.client===config.peer;
 if((client&&!host(client))||(peer&&!host(peer))||(gateway&&!host(gateway))||duplicates)
  add('hosts',3,'Há endereço reservado ou repetido.','Neste /24, use hosts de .1 a .254 e endereços distintos para os computadores.');
 const same=!!client&&!!peer&&network(client)===network(peer);
 if(clientOK&&peerOK&&!same)add('local-network',3,'Os computadores estão em sub-redes diferentes.','Este switch representa uma LAN sem outra rota configurada entre os computadores. Ajuste os três primeiros octetos para o teste local.');
 const gatewayOK=clientOK&&!!gateway&&network(client)==='192.0.2'&&config.gateway==='192.0.2.1'&&config.client!==config.gateway&&config.peer!==config.gateway;
 if(!gatewayOK)add('gateway',3,'O caminho remoto precisa do gateway do cenário.','O roteador deste exercício tem 192.0.2.1/24. O cliente precisa estar nessa rede e apontar para esse gateway, sem duplicar seu endereço.');
 const dnsOK=!!dns&&config.dns==='198.51.100.53';
 if(!dnsOK)add('dns',7,'O DNS informado não é o servidor deste cenário.','Configure 198.51.100.53. Este modelo não testa outros resolvedores da internet.');
 if(!config.service)add('service',7,'O serviço HTTPS está indisponível no modelo.','Ative o serviço no servidor do exercício. Essa falha não é uma prova de invasão.');
 const local=config.cable&&clientOK&&peerOK&&same&&!duplicates;
 const remote=config.cable&&gatewayOK&&!duplicates;
 return {local,remote,site:remote&&dnsOK&&config.service,issues};
}
export function preset(name) {
 const config=DEFAULT_CONFIG();
 if(name==='cabo')config.cable=false;
 else if(name==='subrede')config.peer='192.0.3.20';
 else if(name==='gateway')config.gateway='192.0.2.254';
 else if(name==='dns')config.dns='198.51.100.99';
 else if(name==='servico')config.service=false;
 else if(name!=='normal')throw new Error('Escolha um cenário válido.');
 return config;
}
export const NOTE_FIELDS=['aprendi','experimentei','pendencias'];
export const newNotebook=()=>({schema_version:1,kind:'rede-em-movimento-notebook',step:0,layer:7,config:DEFAULT_CONFIG(),notes:Object.fromEntries(NOTE_FIELDS.map(k=>[k,'']))});
const exact=(object,keys)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===keys.length&&keys.every(k=>Object.hasOwn(object,k));
export function validateNotebook(value) {
 if(!exact(value,['schema_version','kind','step','layer','config','notes'])||value.schema_version!==1||value.kind!=='rede-em-movimento-notebook'||!Number.isInteger(value.step)||value.step<0||value.step>=STEPS.length||!Number.isInteger(value.layer)||value.layer<1||value.layer>7)throw new Error('Use um caderno do Rede em Movimento, esquema 1.');
 if(!exact(value.config,['client','peer','gateway','dns','cable','service'])||typeof value.config.cable!=='boolean'||typeof value.config.service!=='boolean')throw new Error('Configuração do exercício inválida.');
 for(const key of ['client','peer','gateway','dns'])ipv4(value.config[key]);
 if(!exact(value.notes,NOTE_FIELDS)||Object.values(value.notes).some(note=>typeof note!=='string'||note.length>2000))throw new Error('Use três notas de até 2.000 caracteres.');
 return value;
}
export const restoreNotebook=source=>validateNotebook(strictJSON(source));
export function notebookHTML(value) {
 validateNotebook(value);const e=escapeHTML;
 return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';base-uri 'none';form-action 'none'"><title>Rede em Movimento · Meu estudo</title><style>body{font:16px/1.6 system-ui;max-width:850px;padding:24px;margin:auto;color:#12281b}pre,p{white-space:pre-wrap;overflow-wrap:anywhere}section{border:1px solid #bad9c5;padding:20px;margin:16px 0}</style><h1>Meu estudo · Rede em Movimento</h1><p>Exercício simulado; nenhum equipamento foi conectado. Etapa da aula: ${value.step+1}/${STEPS.length}.</p>${NOTE_FIELDS.map(key=>`<section><h2>${{aprendi:'O que aprendi',experimentei:'O que testei',pendencias:'O que quero revisar'}[key]}</h2><p>${e(value.notes[key]||'Sem anotação.')}</p></section>`).join('')}<h2>Configuração do exercício</h2><pre>${e(JSON.stringify(value.config,null,2))}</pre></html>`;
}
