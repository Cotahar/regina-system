import { google } from 'googleapis';
import { db } from '../db/connection.js';
import { notificarMudanca } from './eventos.js';
import { encontrarMunicipio } from './municipios.service.js';
import { registrarOcorrencia } from './ocorrencias.service.js';
import { registrarColetaPelaNota } from './coleta.service.js';
import { gmailConfigurado, criarClienteOAuth } from './gmailImport.service.js';
import {
  htmlParaLinhas, classificarMensagem, interpretarRomaneio, interpretarCancelamento, interpretarEndereco,
  candidatosCidadeDoCadastro, prazoEmbarqueDias, separarCidadeUf
} from './romaneioParser.service.js';

// Importacao dos e-mails da fabrica pra caixa do sistema:
//   "NOTIF TRANSPORTADOR"      -> romaneio: carga liberada pra agendar a coleta
//   "NOTIFICACAO TRANSPORTADOR" -> cancelamento de carga (ou so da NF)
// IMPORTANTE: nao altera NADA na caixa de e-mail (nao marca como lido, nao move).
// O que ja foi lido fica registrado no banco (romaneio_mensagens) - assim o
// servidor de producao e qualquer outro ambiente que leia a mesma caixa nao
// atrapalham um ao outro.

const USUARIO_SISTEMA = 'Sistema (fabrica)';
const MARCAS_FABRICA = ['MOHAWK', 'ELIANE'];

const transportadoraAlvo = () => (process.env.ROMANEIO_TRANSPORTADORA || 'NUNES').toUpperCase();

// A importacao so olha e-mails recebidos A PARTIR de quando foi ativada: o marco
// e gravado na primeira vez que o servidor sobe com o Gmail configurado, e nada
// do historico da caixa e puxado. ROMANEIO_DIAS_RETROATIVOS (opcional) recua o
// marco quando se quer importar tambem um periodo anterior.
export function inicioDaImportacao() {
  const ler = () => db.prepare("SELECT valor FROM romaneio_config WHERE chave = 'inicio_importacao'").get()?.valor;
  if (!ler()) {
    db.prepare("INSERT OR IGNORE INTO romaneio_config (chave, valor) VALUES ('inicio_importacao', ?)").run(new Date().toISOString());
  }
  return ler();
}

function inicioEfetivoMs() {
  const marco = Date.parse(inicioDaImportacao());
  const dias = Number(process.env.ROMANEIO_DIAS_RETROATIVOS) || 0;
  return dias > 0 ? Math.min(marco, Date.now() - dias * 86400000) : marco;
}

// So aceita e-mails de remetentes conhecidos (quem encaminha os avisos da
// fabrica pra caixa do sistema). Sem isso, qualquer pessoa que escrevesse
// "NOTIFICACAO TRANSPORTADOR" pra caixa poderia cancelar cargas reais ou
// criar cargas falsas. Lista separada por virgula; vazia = aceita qualquer um.
const remetentesPermitidos = () => (process.env.ROMANEIO_REMETENTES ?? 'contato@bnuneslogistica.com.br')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function enderecoDoRemetente(cabecalhoFrom) {
  const m = String(cabecalhoFrom || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(cabecalhoFrom || '')).trim().toLowerCase();
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

// Data (AAAA-MM-DD) no horario de Brasilia a partir de um instante ISO/UTC.
function dataBrasilia(iso) {
  return new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function somarDias(dataIso, dias) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function formatarDataBr(dataIso) {
  const m = String(dataIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(dataIso || '');
}

// "09491322996" -> { ddd: '94', telefone: '91322996' } (a fabrica manda com 0 na frente)
function separarFone(fone) {
  let d = soDigitos(fone);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length >= 10 ? { ddd: d.slice(0, 2), telefone: d.slice(2) } : { ddd: null, telefone: null };
}

// Forma oficial da cidade/UF (mesma lista do cadastro de clientes); se nao
// reconhecer, mantem o texto como veio, em maiusculas.
function resolverMunicipio(cidade, uf) {
  const m = cidade ? encontrarMunicipio(cidade, uf) : null;
  if (m) return { cidade: m.cidade.toUpperCase(), uf: m.uf };
  return { cidade: cidade ? String(cidade).toUpperCase() : null, uf: uf ? String(uf).toUpperCase() : null };
}

function inserir(tabela, obj) {
  const colunas = Object.keys(obj);
  const info = db.prepare(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`)
    .run(...colunas.map((c) => (obj[c] === undefined ? null : obj[c])));
  return Number(info.lastInsertRowid);
}

function atualizar(tabela, id, obj) {
  const colunas = Object.keys(obj);
  db.prepare(`UPDATE ${tabela} SET ${colunas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...colunas.map((c) => (obj[c] === undefined ? null : obj[c])), id);
}

function proximoCodigoCliente() {
  for (let n = 0; ; n++) {
    const codigo = `C-${Date.now()}${n ? `-${n}` : ''}`;
    if (!db.prepare('SELECT 1 FROM clientes WHERE codigo_cliente = ?').get(codigo)) return codigo;
  }
}

// Acha o cliente pelo CNPJ; se nao tiver, por nome IDENTICO entre os cadastros
// que ainda nao tem CNPJ (preenche o CNPJ); senao cria. Em cliente existente so
// completa o que esta vazio - nunca sobrescreve o que a equipe cadastrou.
function resolverCliente({ nome, cnpj, fone, cidade, uf, remetente = false, origem }) {
  const nomeUpper = String(nome || '').toUpperCase().trim();
  const { ddd, telefone } = separarFone(fone);
  let existente = cnpj ? db.prepare('SELECT id FROM clientes WHERE cnpj = ?').get(cnpj) : null;

  if (!existente) {
    const chave = semAcento(nomeUpper);
    const mesmoNome = db.prepare("SELECT id, razao_social FROM clientes WHERE cnpj IS NULL OR cnpj = ''").all()
      .filter((c) => semAcento(c.razao_social) === chave);
    if (mesmoNome.length === 1) existente = mesmoNome[0];
  }

  if (existente) {
    db.prepare(`
      UPDATE clientes SET
        cnpj = COALESCE(NULLIF(cnpj, ''), ?), cidade = COALESCE(NULLIF(cidade, ''), ?), estado = COALESCE(NULLIF(estado, ''), ?),
        ddd = COALESCE(NULLIF(ddd, ''), ?), telefone = COALESCE(NULLIF(telefone, ''), ?)
      WHERE id = ?
    `).run(cnpj || null, cidade || null, uf || null, ddd, telefone, existente.id);
    return existente.id;
  }

  // Cliente novo: mesma regra da importacao em CSV - a importacao nao pergunta
  // sobre descarga, entao entra "precisa de ajudantes" (a regra do sistema exige
  // uma forma de descarga) e a equipe ajusta depois se o cliente descarrega sozinho.
  return inserir('clientes', {
    codigo_cliente: proximoCodigoCliente(),
    razao_social: nomeUpper,
    cnpj: cnpj || null,
    ddd,
    telefone,
    cidade: cidade || null,
    estado: uf || null,
    observacoes: `Cadastro criado automaticamente a partir do romaneio da fabrica (${origem || 'carga'}).`,
    is_remetente: remetente ? 1 : 0,
    precisa_ajudantes: 1
  });
}

// A "filial" da fabrica e o remetente da entrega. Acha pelo CNPJ da filial; se o
// cadastro ja tem essa fabrica SEM CNPJ (mesma marca e mesma cidade, so um
// candidato), preenche o CNPJ em vez de duplicar; senao cria.
function resolverRemetente(carga, localColeta) {
  const cnpj = carga.cnpjFilial;
  const porCnpj = cnpj ? db.prepare('SELECT id FROM clientes WHERE cnpj = ?').get(cnpj) : null;
  if (porCnpj) return porCnpj.id;

  const mun = resolverMunicipio(localColeta.cidade, localColeta.uf);
  const candidatos = db.prepare("SELECT id, razao_social, cidade, estado FROM clientes WHERE cnpj IS NULL OR cnpj = ''").all()
    .filter((c) => MARCAS_FABRICA.some((marca) => semAcento(c.razao_social).includes(marca))
      && semAcento(c.cidade) === semAcento(mun.cidade) && (c.estado || '').toUpperCase() === mun.uf);
  if (candidatos.length === 1) {
    db.prepare('UPDATE clientes SET cnpj = ?, is_remetente = 1 WHERE id = ?').run(cnpj, candidatos[0].id);
    return candidatos[0].id;
  }

  return inserir('clientes', {
    codigo_cliente: proximoCodigoCliente(),
    razao_social: `MOHAWK REVESTIMENTOS - ${mun.cidade || 'ORIGEM'} ${mun.uf || ''}`.trim(),
    cnpj: cnpj || null,
    cidade: mun.cidade,
    estado: mun.uf,
    observacoes: 'Filial da fabrica criada automaticamente a partir do romaneio - ajuste o nome se quiser.',
    is_remetente: 1,
    precisa_ajudantes: 1
  });
}

function resolverEnderecos(cliente, carga) {
  const cobranca = interpretarEndereco(carga.campos['Endereco De Cobranca']);
  let destinatario;
  if (cobranca) {
    destinatario = resolverMunicipio(cobranca.cidade, cobranca.uf);
  } else {
    const { uf, candidatos } = candidatosCidadeDoCadastro(cliente.enderecoCadastro);
    const achado = candidatos.map((c) => encontrarMunicipio(c, uf)).find(Boolean);
    destinatario = achado ? { cidade: achado.cidade.toUpperCase(), uf: achado.uf } : { cidade: null, uf };
  }

  const textoEntrega = carga.campos['Endereco De Entrega'] || '';
  const mesmoDoCliente = /O MESMO DO CLIENTE/i.test(textoEntrega);
  const enderecoEntrega = mesmoDoCliente ? null : interpretarEndereco(textoEntrega);
  const entrega = enderecoEntrega ? resolverMunicipio(enderecoEntrega.cidade, enderecoEntrega.uf) : destinatario;

  return {
    destinatario,
    entrega,
    textoEntrega: mesmoDoCliente ? 'O mesmo do cliente' : textoEntrega.trim(),
    aviso: cobranca?.aviso || enderecoEntrega?.aviso || null
  };
}

function observacoesDaOrigem(cliente, carga, enderecos) {
  const c = carga.campos;
  const limpo = (v) => (v && String(v).trim()) || undefined;
  const obj = {
    periodo: limpo(c.Periodo),
    restricao_veiculo: limpo(c['Restricao de veiculo']),
    dificuldade_entrega: limpo(c['Dificuldade de entrega']),
    contato: limpo(c.Contato),
    fone1: limpo(c['Fone (1)']),
    fone2: limpo(c['Fone (2)']),
    email: limpo(c['e-mail']),
    obs: limpo(c.Obs),
    aviso_endereco: enderecos.aviso || undefined,
    redespacho: limpo(cliente.redespacho),
    email_vendedor: limpo(cliente.emailVendedor),
    codigo_cliente_fabrica: cliente.codigo,
    inscricao_estadual: limpo(cliente.ie),
    endereco_cadastro: limpo(cliente.enderecoCadastro),
    data_emissao_amostra: carga.tipoCabecalho === 'AMOSTRA' ? (carga.dataColuna || undefined) : undefined
  };
  return JSON.stringify(Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)));
}

// Entrega disponivel (Montagem) a partir da carga liberada. Usa os dados ja
// gravados em cargas_origem - serve tanto pra importacao quanto pra criar na
// mao (tela de Romaneios) uma entrega que alguem excluiu.
export function criarEntregaDaCargaOrigem(cargaOrigemId) {
  const co = db.prepare('SELECT * FROM cargas_origem WHERE id = ?').get(cargaOrigemId);
  if (!co || !co.cliente_id) return null;
  const jaTem = db.prepare('SELECT id FROM entregas WHERE carga_origem_id = ?').get(co.id);
  if (jaTem) return jaTem.id;

  const nfs = co.tipo === 'amostra' && co.nfs_amostra ? JSON.parse(co.nfs_amostra).map((n) => n.nf).join(', ') : null;
  return inserir('entregas', {
    carga_id: null,
    cliente_id: co.cliente_id,
    remetente_id: co.remetente_id,
    peso_bruto: co.peso_bruto,
    nota_fiscal: nfs || null,
    cidade_entrega: co.cidade_entrega,
    estado_entrega: co.uf_entrega,
    carga_origem_id: co.id
  });
}

function salvarCargaDoRomaneio({ cliente, carga, mensagemNumero, recebidoEm, avisoCif }) {
  const existente = db.prepare('SELECT * FROM cargas_origem WHERE numero_carga = ?').get(carga.numero);
  if (existente && !existente.sem_romaneio && existente.mensagem_numero != null && mensagemNumero != null && mensagemNumero <= existente.mensagem_numero) {
    return { acao: 'ignorada' };
  }

  const enderecos = resolverEnderecos(cliente, carga);
  const localColeta = separarCidadeUf(carga.localColetaLinhas.at(-1));
  const clienteId = resolverCliente({
    nome: cliente.nome, cnpj: cliente.cnpj, fone: cliente.fone,
    cidade: enderecos.destinatario.cidade, uf: enderecos.destinatario.uf, origem: `carga ${carga.numero}`
  });
  const remetenteId = resolverRemetente(carga, localColeta);

  // Carga que so existia como cancelamento (chegou antes do romaneio) conta a
  // liberacao a partir do romaneio.
  const liberadaEm = existente && !existente.sem_romaneio ? existente.liberada_em : recebidoEm;
  const dias = prazoEmbarqueDias(cliente.prazos, enderecos.entrega.uf);
  const prazoLimite = dias != null ? somarDias(dataBrasilia(liberadaEm), dias) : null;

  const dados = {
    tipo: carga.tipoCabecalho === 'AMOSTRA' ? 'amostra' : 'carga',
    filial_cnpj: carga.cnpjFilial,
    filial_nome: carga.filial,
    local_coleta: carga.localColetaLinhas.join(', '),
    remetente_id: remetenteId,
    cliente_id: clienteId,
    destinatario_nome: cliente.nome.toUpperCase(),
    destinatario_cnpj: cliente.cnpj,
    destinatario_cidade: enderecos.destinatario.cidade,
    destinatario_uf: enderecos.destinatario.uf,
    endereco_entrega: enderecos.textoEntrega,
    entrega_na_obra: carga.entregaNaObra ? 1 : 0,
    cidade_entrega: enderecos.entrega.cidade,
    uf_entrega: enderecos.entrega.uf,
    modalidade_frete: (carga.campos['Modalidade Frete'] || '').trim() || null,
    tipo_venda: (carga.campos['Tipo de Venda'] || '').trim() || null,
    vendedor: cliente.vendedor,
    transportadora: [cliente.transportadora, cliente.redespacho ? `(redesp.: ${cliente.redespacho})` : null].filter(Boolean).join(' '),
    cronograma: carga.tipoCabecalho === 'CARGA' ? carga.dataColuna : null,
    peso_bruto: carga.pesoBruto,
    caixas: carga.caixas,
    valor_mercadoria: carga.valorTotal,
    observacoes_origem: observacoesDaOrigem(cliente, carga, enderecos),
    itens: JSON.stringify(carga.itens),
    nfs_amostra: carga.nfsAmostra.length ? JSON.stringify(carga.nfsAmostra) : null,
    regras: JSON.stringify({ regras: cliente.regras, prazos: cliente.prazos, aviso_cif: (carga.campos['Modalidade Frete'] || '').trim() === 'CIF' ? avisoCif : [] }),
    prazo_embarque_dias: dias,
    prazo_limite: prazoLimite,
    mensagem_numero: mensagemNumero,
    atualizado_em: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };

  let id;
  let acao;
  if (!existente) {
    id = inserir('cargas_origem', { numero_carga: carga.numero, status: 'disponivel', liberada_em: recebidoEm, ...dados });
    acao = 'nova';
  } else {
    id = existente.id;
    atualizar('cargas_origem', id, { ...dados, sem_romaneio: 0, liberada_em: existente.sem_romaneio ? recebidoEm : existente.liberada_em });
    acao = 'atualizada';
  }

  const status = existente ? existente.status : 'disponivel';
  const entrega = db.prepare('SELECT id, data_coleta FROM entregas WHERE carga_origem_id = ?').get(id);
  const nossa = [cliente.transportadora, cliente.redespacho].some((t) => semAcento(t).includes(transportadoraAlvo()));

  if (entrega) {
    // Reenvio da fabrica: acompanha o peso enquanto a carga ainda nao foi coletada.
    if (!entrega.data_coleta && carga.pesoBruto != null) db.prepare('UPDATE entregas SET peso_bruto = ? WHERE id = ?').run(carga.pesoBruto, entrega.id);
  } else if (!existente && status !== 'cancelada' && nossa) {
    criarEntregaDaCargaOrigem(id);
  }
  return { acao, id, numero: carga.numero };
}

function entregaDaCarga(cargaOrigemId) {
  return db.prepare('SELECT id, carga_id, ordem_coleta_id, data_coleta FROM entregas WHERE carga_origem_id = ?').get(cargaOrigemId) || null;
}

function criarCargaSoComCancelamento(item, extra) {
  const { cidade, uf } = separarCidadeUf(item.destino);
  const mun = resolverMunicipio(cidade, uf);
  return inserir('cargas_origem', {
    numero_carga: item.carga,
    status: 'cancelada',
    sem_romaneio: 1,
    destinatario_nome: (item.cliente || '').toUpperCase(),
    destinatario_cidade: mun.cidade,
    destinatario_uf: mun.uf,
    cidade_entrega: mun.cidade,
    uf_entrega: mun.uf,
    peso_bruto: item.peso || null,
    liberada_em: item.dataOriginal ? `${item.dataOriginal}T12:00:00.000Z` : null,
    ...extra
  });
}

function registrarCancelamentoCarga(item, { motivo, recebidoEm }) {
  const co = db.prepare('SELECT * FROM cargas_origem WHERE numero_carga = ?').get(item.carga);
  if (!co) {
    criarCargaSoComCancelamento(item, { cancelada_em: recebidoEm, motivo_cancelamento: motivo });
    return;
  }
  if (co.status === 'cancelada') {
    if (!co.motivo_cancelamento && motivo) db.prepare('UPDATE cargas_origem SET motivo_cancelamento = ? WHERE id = ?').run(motivo, co.id);
    return;
  }
  db.prepare("UPDATE cargas_origem SET status = 'cancelada', cancelada_em = ?, motivo_cancelamento = ?, atualizado_em = datetime('now') WHERE id = ?")
    .run(recebidoEm, motivo, co.id);

  // So registra na linha do tempo da carga quando a entrega ja esta numa carga
  // do sistema (ai a equipe precisa ficar sabendo). Entrega solta, sem uso,
  // simplesmente sai da Montagem (ver cargas_origem.status nas consultas).
  const entrega = entregaDaCarga(co.id);
  if (entrega?.carga_id) {
    registrarOcorrencia(entrega.carga_id,
      `ATENCAO: a carga ${co.numero_carga} da fabrica foi CANCELADA pela fabrica em ${formatarDataBr(dataBrasilia(recebidoEm))}${motivo ? ` (motivo: ${motivo})` : ''}.`,
      USUARIO_SISTEMA);
  }
}

function registrarCancelamentoNf(item, { recebidoEm }) {
  const co = db.prepare('SELECT * FROM cargas_origem WHERE numero_carga = ?').get(item.carga);

  // Nota ainda sem uso: tira da fila (ignorada). Nota ja ligada a entrega nao e
  // mexida sozinha - fica o alerta pra equipe decidir.
  db.prepare("UPDATE notas_fiscais_email SET status = 'ignorada' WHERE status = 'pendente' AND (numero_nf = ? OR numero_nf = ?)")
    .run(String(item.nf), String(item.nf).padStart(9, '0'));

  // Carga que nunca chegou por romaneio: o cancelamento fica so no historico de
  // e-mails (romaneio_mensagens) - nao ha o que marcar.
  if (!co) return;
  db.prepare("UPDATE cargas_origem SET nf_cancelada_numero = ?, nf_cancelada_em = ?, atualizado_em = datetime('now') WHERE id = ?")
    .run(item.nf, recebidoEm, co.id);

  const entrega = entregaDaCarga(co.id);
  if (entrega?.carga_id) {
    registrarOcorrencia(entrega.carga_id,
      `ATENCAO: a NF ${item.nf} da carga ${co.numero_carga} foi CANCELADA pela fabrica em ${formatarDataBr(dataBrasilia(recebidoEm))}.`,
      USUARIO_SISTEMA);
  }
}

// Notas que ja tinham chegado ANTES do romaneio ser lido (ex.: o ciclo das notas
// rodou primeiro) passam a ligar assim que a carga existe.
function vincularNotasPendentes(numeroCarga) {
  const co = db.prepare('SELECT id, tipo, nfs_amostra FROM cargas_origem WHERE numero_carga = ?').get(numeroCarga);
  if (!co) return;
  const ids = new Set(db.prepare("SELECT id FROM notas_fiscais_email WHERE carga_origem = ? AND status = 'pendente'").all(numeroCarga).map((n) => n.id));
  if (co.tipo === 'amostra' && co.nfs_amostra) {
    for (const { nf } of JSON.parse(co.nfs_amostra)) {
      for (const n of db.prepare("SELECT id FROM notas_fiscais_email WHERE status = 'pendente' AND (numero_nf = ? OR numero_nf = ?)").all(nf, nf.padStart(9, '0'))) ids.add(n.id);
    }
  }
  for (const id of ids) registrarColetaPelaNota(id);
}

// Processa UM e-mail ja baixado. Exportada separada do Gmail pra poder ser
// testada com e-mails salvos. Tudo-ou-nada por e-mail; erro de interpretacao
// vira registro 'erro' (visivel na tela) em vez de travar o ciclo.
export function processarEmail({ gmailId, assunto, recebidoEm, html }) {
  if (db.prepare('SELECT id FROM romaneio_mensagens WHERE gmail_message_id = ?').get(gmailId)) return { duplicada: true };

  const linhas = htmlParaLinhas(html);
  const tipo = classificarMensagem(linhas);
  const resumo = { tipo, novas: 0, atualizadas: 0, ignoradas: 0, canceladas: 0, nfCanceladas: 0 };
  const paraVincular = [];
  const corpoTexto = linhas.join('\n').slice(0, 60000);

  db.exec('BEGIN');
  try {
    let mensagemNumero = null;
    const cargasCitadas = [];

    if (tipo === 'romaneio') {
      const r = interpretarRomaneio(linhas);
      mensagemNumero = r.mensagemNumero;
      for (const cliente of r.clientes) {
        for (const carga of cliente.cargas) {
          if (!carga.numero) continue;
          const res = salvarCargaDoRomaneio({ cliente, carga, mensagemNumero, recebidoEm, avisoCif: r.avisoCif });
          cargasCitadas.push(carga.numero);
          if (res.acao === 'nova') { resumo.novas++; paraVincular.push(carga.numero); }
          else if (res.acao === 'atualizada') resumo.atualizadas++;
          else resumo.ignoradas++;
        }
      }
    } else if (tipo === 'cancelamento_carga' || tipo === 'cancelamento_nf') {
      const r = interpretarCancelamento(linhas);
      mensagemNumero = r.mensagemNumero;
      for (const item of r.itens) {
        cargasCitadas.push(item.carga);
        if (tipo === 'cancelamento_carga') { registrarCancelamentoCarga(item, { motivo: r.motivo, recebidoEm }); resumo.canceladas++; }
        else { registrarCancelamentoNf(item, { recebidoEm }); resumo.nfCanceladas++; }
      }
    }

    inserir('romaneio_mensagens', {
      gmail_message_id: gmailId,
      tipo: tipo === 'desconhecida' ? 'ignorada' : tipo,
      assunto,
      mensagem_numero: mensagemNumero,
      recebido_em: recebidoEm,
      cargas: cargasCitadas.join(','),
      corpo_texto: corpoTexto
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    try {
      inserir('romaneio_mensagens', { gmail_message_id: gmailId, tipo: 'erro', assunto, recebido_em: recebidoEm, corpo_texto: corpoTexto, erro: String(err.message).slice(0, 500) });
    } catch { /* ja registrado por outra execucao */ }
    return { erro: err.message };
  }

  for (const numero of paraVincular) vincularNotasPendentes(numero);
  return resumo;
}

// ---------------------------------------------------------------- Gmail (so leitura)

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function comEspera(chamada) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await chamada();
    } catch (err) {
      const limite = err.code === 403 && /rateLimit|Quota/i.test(err.message || '');
      if (!limite || tentativa >= 5) throw err;
      await dormir(40000);
    }
  }
}

function partes(parte, acc = []) {
  acc.push(parte);
  (parte.parts || []).forEach((p) => partes(p, acc));
  return acc;
}

function corpoHtml(mensagem) {
  const todas = partes(mensagem.payload);
  const escolhida = todas.find((p) => p.mimeType === 'text/html' && p.body?.data) || todas.find((p) => p.mimeType === 'text/plain' && p.body?.data);
  return escolhida ? Buffer.from(escolhida.body.data, 'base64url').toString('utf-8') : '';
}

let cicloEmAndamento = false;

export async function executarCicloRomaneios() {
  if (!gmailConfigurado()) return { desativado: true };
  if (cicloEmAndamento) return { emAndamento: true };
  cicloEmAndamento = true;
  try {
    const gmail = google.gmail({ version: 'v1', auth: criarClienteOAuth() });
    const inicioMs = inicioEfetivoMs();
    const consulta = `(subject:"NOTIF TRANSPORTADOR" OR subject:"NOTIFICACAO TRANSPORTADOR") after:${Math.floor(inicioMs / 1000)}`;

    const ids = [];
    let pageToken;
    do {
      const { data } = await comEspera(() => gmail.users.messages.list({ userId: 'me', q: consulta, maxResults: 100, pageToken }));
      (data.messages || []).forEach((m) => ids.push(m.id));
      pageToken = data.nextPageToken;
    } while (pageToken && ids.length < 500);

    const novos = ids.filter((id) => !db.prepare('SELECT 1 FROM romaneio_mensagens WHERE gmail_message_id = ?').get(id));
    const mensagens = [];
    for (const id of novos) {
      await dormir(250);
      const { data } = await comEspera(() => gmail.users.messages.get({ userId: 'me', id, format: 'full' }));
      const cabecalho = (nome) => data.payload?.headers?.find((h) => h.name.toLowerCase() === nome)?.value || '';
      const assunto = cabecalho('subject');
      const recebidoEm = new Date(Number(data.internalDate)).toISOString();
      if (Date.parse(recebidoEm) < inicioMs) continue; // anterior a ativacao: nao importa
      const permitidos = remetentesPermitidos();
      const remetente = enderecoDoRemetente(cabecalho('from'));
      if (permitidos.length && !permitidos.includes(remetente)) {
        // Fica registrado (pra nao ser baixado de novo a cada ciclo), mas nao e interpretado.
        db.prepare("INSERT OR IGNORE INTO romaneio_mensagens (gmail_message_id, tipo, assunto, recebido_em, erro) VALUES (?, 'ignorada', ?, ?, ?)")
          .run(id, assunto, recebidoEm, `remetente nao autorizado: ${remetente}`.slice(0, 200));
        continue;
      }
      mensagens.push({ gmailId: id, assunto, recebidoEm, html: corpoHtml(data) });
    }
    mensagens.sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm));

    const total = { emails: mensagens.length, novas: 0, atualizadas: 0, canceladas: 0, nfCanceladas: 0, erros: 0 };
    for (const m of mensagens) {
      const r = processarEmail(m);
      if (r.erro) { total.erros++; console.error(`[romaneios] erro no e-mail ${m.gmailId}: ${r.erro}`); continue; }
      total.novas += r.novas || 0;
      total.atualizadas += r.atualizadas || 0;
      total.canceladas += r.canceladas || 0;
      total.nfCanceladas += r.nfCanceladas || 0;
    }
    if (mensagens.length) notificarMudanca('romaneios');
    return total;
  } finally {
    cicloEmAndamento = false;
  }
}

// E-mails que falharam ficam registrados como 'erro'; isto apaga o registro pra
// eles serem lidos de novo no proximo ciclo (depois de um ajuste, por exemplo).
export function liberarErrosParaReprocessar() {
  return db.prepare("DELETE FROM romaneio_mensagens WHERE tipo = 'erro'").run().changes;
}

export function iniciarPollingRomaneios() {
  if (!gmailConfigurado()) {
    console.log('[romaneios] Gmail nao configurado - importacao dos romaneios da fabrica desativada.');
    return;
  }
  const intervalo = Number(process.env.GMAIL_POLL_INTERVAL_MS) || 180000;
  // Fixa o marco ja na subida (e nao no primeiro ciclo, 20s depois), pra nao perder e-mails desse intervalo.
  const desde = new Date(inicioEfetivoMs()).toISOString();
  console.log(`[romaneios] importacao automatica ativa (a cada ${Math.round(intervalo / 1000)}s; e-mails recebidos desde ${desde}; so leitura da caixa).`);

  const ciclo = () => executarCicloRomaneios()
    .then((r) => { if (r?.emails) console.log(`[romaneios] ${r.emails} e-mail(s): ${r.novas} carga(s) nova(s), ${r.atualizadas} atualizada(s), ${r.canceladas} cancelamento(s), ${r.nfCanceladas} NF cancelada(s), ${r.erros} erro(s).`); })
    .catch((err) => console.error('[romaneios] erro no ciclo:', err.message));

  setTimeout(ciclo, 20000).unref();
  setInterval(ciclo, intervalo).unref();
}
