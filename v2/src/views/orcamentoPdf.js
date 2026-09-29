import { escapeHtml } from '../utils/html.js';
import { formatarMoedaServidor } from '../utils/formatters.js';

// Segue o modelo real usado nas propostas ja enviadas a clientes (mesmo
// cabecalho/CNPJ/endereco/assinatura em todas) - diferente dos relatorios
// internos (Espelho, Ordem de Coleta), esse documento representa a empresa
// pro cliente final. Layout classico de carta comercial (aprovado pelo
// usuario apos uma primeira versao "decorada demais") - preto sobre branco,
// alinhamento em coluna fixa, sem cor alem da logo.
const EMPRESA = {
  nome: 'B. Nunes Logística LTDA',
  cnpj: '34.524.242/0001-04',
  endereco: 'Rua Olivio Pietro Menegasso, 139, Rio Belo, Orleans/SC',
  contatoNome: 'Ruan Patricio',
  contatoTelefone: '(48) 9 9858-5053',
  contatoEmail: 'contato@bnuneslogistica.com.br'
};

function formatarDataPorExtenso(valorIso) {
  if (!valorIso) return '';
  const d = new Date(`${valorIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return valorIso;
  return `Orleans, ${d.getDate()} de ${d.toLocaleDateString('pt-BR', { month: 'long' })} de ${d.getFullYear()}.`;
}

function formatarCnpj(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj || '-';
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatarPesoTon(pesoKg) {
  return `${(pesoKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ton`;
}

function linhaInfo(rotulo, valor, destaque = false) {
  return `<div class="linha-info${destaque ? ' destaque' : ''}"><span class="rotulo">${escapeHtml(rotulo)}</span><span>${valor}</span></div>`;
}

export function renderOrcamentoPdf({ orcamento: o, itens }) {
  const destino = [o.destino_cidade, o.destino_estado].filter(Boolean).join('/');
  const produto = o.produto || 'mercadorias';

  // Um bloco por item, no mesmo alinhamento em coluna do resto da carta - a
  // linha de descarga so aparece nos itens que realmente tem (fica
  // implicito, sem dizer nada, quando o cliente descarrega por conta propria).
  const blocosItens = itens.map((item) => {
    const linhas = [linhaInfo('ORIGEM:', escapeHtml(item.remetente_nome))];
    linhas.push(linhaInfo('PESO:', formatarPesoTon(item.peso_kg)));
    if (item.valor_tonelada) linhas.push(linhaInfo('FRETE/TON:', formatarMoedaServidor(item.valor_tonelada)));
    linhas.push(linhaInfo(item.valor_tonelada ? 'TOTAL:' : 'FRETE TOTAL:', formatarMoedaServidor(item.valor_frete_total), true));
    if (item.descarga_inclusa) linhas.push(linhaInfo('', 'Descarga inclusa*'));
    return `<div class="bloco-item">${linhas.join('')}</div>`;
  }).join('<div class="separador-item"></div>');

  const algumaDescargaInclusa = itens.some((item) => item.descarga_inclusa);

  const bullets = [];
  if (algumaDescargaInclusa && o.descarga_metros) bullets.push(`*Descarga inclusa até ${o.descarga_metros} metros do veículo, em terreno plano;`);
  if (o.mercadoria_segurada) bullets.push('Mercadoria totalmente segurada.');
  if (o.frete_ajustavel_diesel) bullets.push('Frete passível de reajuste proporcional em caso de variação relevante do óleo diesel.');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta ${escapeHtml(o.codigo)} - ${escapeHtml(o.destinatario_nome)}</title>
  <link href="https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'PT Serif', Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.55; color: #1a1a1a; margin: 0; background: #fff; }
    .pagina { max-width: 700px; margin: 0 auto; padding: 40px 36px 56px; }
    .no-print { padding: 14px 36px 0; max-width: 700px; margin: 0 auto; }
    .no-print button { background: #f2c200; color: #1a1a1a; border: none; border-radius: 4px; padding: 8px 16px; font-family: Arial, sans-serif; font-weight: bold; font-size: 13px; cursor: pointer; }
    @media print { .no-print { display: none; } .pagina { max-width: none; padding: 0; } }

    .logo { height: 54px; display: block; }
    .dados-empresa { margin-top: 10px; font-size: 11px; color: #595959; line-height: 1.5; }

    .regua { margin-top: 18px; border-top: 1px solid #b3b3b3; }

    .data { margin-top: 22px; }

    .destinatario-nome { margin-top: 20px; font-weight: 700; text-transform: uppercase; }
    .destinatario-cnpj { margin-top: 2px; }

    .intro { margin-top: 20px; max-width: 620px; }

    .bloco-info { margin-top: 20px; padding: 14px 0; border-top: 1px solid #b3b3b3; border-bottom: 1px solid #b3b3b3; }
    .separador-item { border-top: 1px dashed #d9d9d9; margin: 10px 0; }
    .linha-info { display: flex; padding: 3px 0; }
    .linha-info .rotulo { width: 150px; flex-shrink: 0; font-weight: 700; }
    .linha-info.destaque { margin-top: 8px; font-weight: 700; font-size: 15px; }

    .prazos { margin-top: 18px; }

    .bullets { margin-top: 22px; }
    .bullets .item { display: flex; gap: 8px; }

    .obs { margin-top: 18px; font-size: 12.5px; color: #595959; white-space: pre-wrap; }

    .assinatura { margin-top: 40px; }
    .assinatura .nome { margin-top: 4px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>
  <div class="pagina">
    <img class="logo" src="/images/logo-bnunes.png" alt="B. Nunes Logística e Transportes">
    <div class="dados-empresa">
      <div><strong>${escapeHtml(EMPRESA.nome)}</strong> – CNPJ ${EMPRESA.cnpj}</div>
      <div>Endereço: ${escapeHtml(EMPRESA.endereco)}</div>
      <div>Contato: ${EMPRESA.contatoNome} ${EMPRESA.contatoTelefone} – ${EMPRESA.contatoEmail}</div>
    </div>

    <div class="regua"></div>

    <p class="data">${formatarDataPorExtenso(o.data)}</p>

    <p class="destinatario-nome">${escapeHtml(o.destinatario_nome)}</p>
    <p class="destinatario-cnpj">CNPJ: ${formatarCnpj(o.destinatario_cnpj)}</p>

    <p class="intro">Proposta de frete para transportar ${escapeHtml(produto)}${destino ? ` com destino a <strong>${escapeHtml(destino)}</strong>` : ''}.</p>

    <div class="bloco-info">${blocosItens}</div>

    <div class="prazos">
      ${o.prazo_entrega ? linhaInfo('PRAZO DE ENTREGA:', escapeHtml(o.prazo_entrega)) : ''}
      ${o.forma_pagamento ? linhaInfo('FORMA DE PAGAMENTO:', escapeHtml(o.forma_pagamento)) : ''}
    </div>

    ${bullets.length ? `<div class="bullets">${bullets.map((b) => `<div class="item"><span>&bull;</span><span>${escapeHtml(b)}</span></div>`).join('')}</div>` : ''}

    ${o.observacoes ? `<p class="obs">OBS: ${escapeHtml(o.observacoes)}</p>` : ''}

    <div class="assinatura">
      <p>Atenciosamente,</p>
      <p class="nome">${escapeHtml(EMPRESA.contatoNome)}</p>
      <p>${EMPRESA.contatoTelefone}</p>
    </div>
  </div>
</body>
</html>`;
}
