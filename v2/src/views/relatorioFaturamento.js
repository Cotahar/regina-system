import { escapeHtml } from '../utils/html.js';
import { formatarMoedaServidor, formatarPesoServidor, formatarDataServidor } from '../utils/formatters.js';

function nfComQuebra(notaFiscal) {
  return (notaFiscal || '')
    .split('/')
    .map((parte) => escapeHtml(parte.trim()))
    .filter(Boolean)
    .join('<br>');
}

function contatoTexto(ddd, telefone) {
  if (ddd && telefone) return `(${escapeHtml(ddd)}) ${escapeHtml(telefone)}`;
  if (telefone) return escapeHtml(telefone);
  return '-';
}

export function renderRelatorioFaturamento({ carga, entregas, destinoPrincipal }) {
  let pesoTotal = 0;
  let freteTotal = 0;

  const linhas = entregas.map((e) => {
    pesoTotal += e.peso_bruto || 0;
    freteTotal += e.valor_frete || 0;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(e.cliente_razao_social || 'N/A')}</strong>
          ${e.is_cortesia ? '<span class="badge badge-cortesia">Cortesia</span>' : ''}
          ${e.cliente_observacoes ? `<div class="obs-cliente">Obs. cliente: ${escapeHtml(e.cliente_observacoes)}</div>` : ''}
        </td>
        <td>${contatoTexto(e.cliente_ddd, e.cliente_telefone)}</td>
        <td>${nfComQuebra(e.nota_fiscal)}</td>
        <td>${escapeHtml(e.unidade_nome || '')}</td>
        <td>${escapeHtml(e.tipo_cte_descricao || '')}</td>
        <td>${escapeHtml(e.forma_pagamento_descricao || '')}</td>
        <td>${escapeHtml(e.tipo_pagamento || '')}</td>
        <td class="num">${formatarPesoServidor(e.peso_bruto)}</td>
        <td class="num">${formatarMoedaServidor(e.valor_tonelada)}</td>
        <td class="num">${formatarMoedaServidor(e.valor_frete)}</td>
      </tr>
    `;
  }).join('');

  const observacoes = [
    carga.observacoes ? { rotulo: 'Observacoes da carga', texto: carga.observacoes, classe: 'obs-carga' } : null,
    carga.observacoes_faturamento ? { rotulo: 'Observacoes de faturamento', texto: carga.observacoes_faturamento, classe: 'obs-faturamento' } : null
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatorio de Faturamento - ${escapeHtml(carga.codigo_carga)}</title>
  <style>
    :root {
      --amarelo: #facc15;
      --preto: #111827;
      --cinza-texto: #374151;
      --cinza-borda: #d1d5db;
      --cinza-fundo: #f3f4f6;
    }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: var(--cinza-texto); margin: 0; background: #fff; }
    .pagina { max-width: 1100px; margin: 0 auto; padding: 0 20px 24px; }
    .no-print { padding: 12px 20px 0; }
    .no-print button { background: var(--amarelo); color: var(--preto); border: none; border-radius: 6px; padding: 8px 16px; font-weight: bold; font-size: 13px; cursor: pointer; }
    @media print { .no-print { display: none; } .pagina { max-width: none; padding: 0 8px; } }

    .header-band { background: var(--preto); color: #fff; padding: 16px 20px; margin: 12px 0 16px; border-radius: 8px; display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .header-band .marca { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--amarelo); font-weight: bold; }
    .header-band h1 { font-size: 20px; margin: 2px 0 0; }
    .header-band .frota-badge { background: var(--amarelo); color: var(--preto); font-weight: bold; font-size: 10px; letter-spacing: 0.04em; padding: 3px 10px; border-radius: 999px; align-self: center; }

    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px; background: var(--cinza-fundo); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
    .info-grid .item .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .info-grid .item .valor { font-size: 13px; font-weight: bold; color: var(--preto); }

    .obs-bloco { border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; border: 1px solid; }
    .obs-bloco .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
    .obs-bloco .texto { margin-top: 2px; white-space: pre-wrap; }
    .obs-carga { background: #fefce8; border-color: #fde047; border-left: 4px solid var(--amarelo); }
    .obs-carga .rotulo { color: #854d0e; }
    .obs-faturamento { background: #eff6ff; border-color: #bfdbfe; border-left: 4px solid #3b82f6; }
    .obs-faturamento .rotulo { color: #1e40af; }

    h2 { font-size: 14px; color: var(--preto); border-left: 5px solid var(--amarelo); padding-left: 8px; margin: 18px 0 8px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    thead th { background: var(--preto); color: var(--amarelo); text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; padding: 6px 7px; }
    tbody td { border: 1px solid var(--cinza-borda); border-top: none; padding: 6px 7px; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.num, th.num { text-align: right; white-space: nowrap; }

    .badge { display: inline-block; border-radius: 999px; padding: 1px 7px; font-size: 9px; margin-left: 4px; }
    .badge-cortesia { background: #dcfce7; color: #166534; }
    .obs-cliente { font-size: 10px; color: #6b7280; margin-top: 2px; font-style: italic; }

    .totais { margin-top: 12px; background: var(--cinza-fundo); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 10px 16px; font-weight: bold; color: var(--preto); display: flex; gap: 24px; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir</button></div>
  <div class="pagina">
    <div class="header-band">
      <div>
        <div class="marca">Frottex &middot; B. Nunes</div>
        <h1>Relatorio de Faturamento - ${escapeHtml(carga.codigo_carga)}</h1>
      </div>
      ${carga.veiculo_frota ? '<span class="frota-badge">FROTA</span>' : ''}
    </div>

    <div class="info-grid">
      <div class="item"><div class="rotulo">Origem</div><div class="valor">${escapeHtml(carga.origem)}</div></div>
      <div class="item"><div class="rotulo">Destino</div><div class="valor">${escapeHtml(destinoPrincipal)}</div></div>
      <div class="item"><div class="rotulo">Motorista</div><div class="valor">${escapeHtml(carga.motorista_nome || 'N/A')}</div></div>
      <div class="item"><div class="rotulo">Veiculo</div><div class="valor">${escapeHtml(carga.placa_veiculo || 'N/A')}</div></div>
      <div class="item"><div class="rotulo">Rota manifesto</div><div class="valor">${escapeHtml(carga.rota_manifesto || '-')}</div></div>
      <div class="item"><div class="rotulo">Vale pedagio</div><div class="valor">${escapeHtml(carga.vale_pedagio_marca || '-')} ${escapeHtml(carga.vale_pedagio_rota || '')} (${carga.vale_pedagio_eixos || 0} eixos)</div></div>
      <div class="item"><div class="rotulo">Frete pago ao motorista</div><div class="valor">${formatarMoedaServidor(carga.frete_pago)}</div></div>
      <div class="item"><div class="rotulo">Adiantamento (${carga.adiantamento_percentual || 0}%)</div><div class="valor">${formatarMoedaServidor(carga.adiantamento_valor)}</div></div>
      <div class="item"><div class="rotulo">Data</div><div class="valor">${formatarDataServidor(new Date().toISOString())}</div></div>
    </div>

    ${observacoes.map((o) => `<div class="obs-bloco ${o.classe}"><div class="rotulo">${o.rotulo}</div><div class="texto">${escapeHtml(o.texto)}</div></div>`).join('')}

    <h2>Entregas</h2>
    <table>
      <thead>
        <tr>
          <th>Cliente</th><th>Contato</th><th>NF</th><th>Unidade</th><th>Tipo CT-e</th><th>Forma Pgto</th><th>Tipo Pgto</th>
          <th class="num">Peso</th><th class="num">R$/Ton</th><th class="num">Frete</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>

    <div class="totais">
      <span>Peso total: ${formatarPesoServidor(pesoTotal)}</span>
      <span>Frete total: ${formatarMoedaServidor(freteTotal)}</span>
    </div>
  </div>
</body>
</html>`;
}
