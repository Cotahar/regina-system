import { escapeHtml } from '../utils/html.js';
import { formatarPesoServidor, formatarDataServidor } from '../utils/formatters.js';

// Relatorio pro motorista que vai fazer a coleta - agrupado por remetente
// (fabrica), que e a informacao que importa pra saber onde parar. Mesmo
// estilo visual do Espelho de Carga, pra manter consistencia entre os
// documentos impressos do sistema.
export function renderOrdemColetaRelatorio({ ordem, entregas }) {
  const grupos = new Map();
  for (const e of entregas) {
    const nome = e.remetente_razao_social || 'SEM REMETENTE';
    const chave = `${nome}|${e.remetente_cidade || ''}|${e.remetente_estado || ''}`;
    if (!grupos.has(chave)) grupos.set(chave, { nome, cidadeUf: [e.remetente_cidade, e.remetente_estado].filter(Boolean).join(' - '), itens: [], peso: 0 });
    const g = grupos.get(chave);
    g.itens.push(e);
    g.peso += e.peso_bruto || 0;
  }

  const pesoTotal = entregas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);

  const blocos = [...grupos.values()].map((g) => `
    <div class="fabrica">
      <h3>${escapeHtml(g.nome)} ${g.cidadeUf ? `<span class="cidade-uf">(${escapeHtml(g.cidadeUf)})</span>` : ''} <span class="peso-fabrica">${formatarPesoServidor(g.peso)}</span></h3>
      <table>
        <thead><tr><th>NF</th><th>Destinatario</th><th>Cidade/UF</th><th class="num">Peso</th><th>Carga de origem</th></tr></thead>
        <tbody>
          ${g.itens.map((e) => `
            <tr>
              <td>${escapeHtml(e.nota_fiscal || '-')}</td>
              <td><strong>${escapeHtml(e.cliente_razao_social || 'N/A')}</strong></td>
              <td>${escapeHtml([e.cidade_entrega || e.cliente_cidade, e.estado_entrega || e.cliente_estado].filter(Boolean).join(' - ') || '-')}</td>
              <td class="num">${formatarPesoServidor(e.peso_bruto)}</td>
              <td>${e.carga_codigo ? `${escapeHtml(e.carga_codigo)} (${escapeHtml(e.carga_status)})` : 'Disponivel (Montagem)'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem de Coleta ${escapeHtml(ordem.codigo)}</title>
  <style>
    :root {
      --amarelo: #facc15;
      --preto: #111827;
      --cinza-texto: #374151;
      --cinza-borda: #d1d5db;
      --cinza-fundo: #f3f4f6;
    }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: var(--cinza-texto); margin: 0; background: #fff; }
    .pagina { max-width: 900px; margin: 0 auto; padding: 0 20px 24px; }
    .no-print { padding: 12px 20px 0; }
    .no-print button { background: var(--amarelo); color: var(--preto); border: none; border-radius: 6px; padding: 8px 16px; font-weight: bold; font-size: 13px; cursor: pointer; }
    @media print { .no-print { display: none; } .pagina { max-width: none; padding: 0 8px; } }

    .header-band { background: var(--preto); color: #fff; padding: 16px 20px; margin: 12px 0 16px; border-radius: 8px; display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .header-band .marca { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--amarelo); font-weight: bold; }
    .header-band h1 { font-size: 20px; margin: 2px 0 0; }
    .header-band .status-badge { background: var(--amarelo); color: var(--preto); font-weight: bold; font-size: 10px; letter-spacing: 0.04em; padding: 3px 10px; border-radius: 999px; align-self: center; text-transform: uppercase; }

    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px; background: var(--cinza-fundo); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .info-grid .item .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .info-grid .item .valor { font-size: 13px; font-weight: bold; color: var(--preto); }

    h2 { font-size: 14px; color: var(--preto); border-left: 5px solid var(--amarelo); padding-left: 8px; margin: 20px 0 8px; }
    h3 { font-size: 12.5px; color: var(--preto); background: var(--cinza-fundo); border-radius: 6px 6px 0 0; margin: 0; padding: 7px 10px; border: 1px solid var(--cinza-borda); border-bottom: none; }
    .cidade-uf, .peso-fabrica { font-weight: normal; color: #6b7280; }
    .peso-fabrica { float: right; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    thead th { background: var(--preto); color: var(--amarelo); text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; padding: 6px 8px; }
    tbody td { border: 1px solid var(--cinza-borda); border-top: none; padding: 6px 8px; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.num, th.num { text-align: right; white-space: nowrap; }

    .fabrica { margin-bottom: 16px; }
    .fabrica table { margin-bottom: 0; }

    .obs-carga { background: #fefce8; border: 1px solid #fde047; border-left: 4px solid var(--amarelo); border-radius: 6px; padding: 10px 14px; margin-top: 16px; }
    .obs-carga .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #854d0e; font-weight: bold; }
    .obs-carga .texto { margin-top: 2px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir</button></div>
  <div class="pagina">
    <div class="header-band">
      <div>
        <div class="marca">Frottex &middot; B. Nunes</div>
        <h1>Ordem de Coleta - ${escapeHtml(ordem.codigo)}</h1>
      </div>
      <span class="status-badge">${ordem.status === 'coletada' ? 'Coletada' : 'Pendente'}</span>
    </div>

    <div class="info-grid">
      <div class="item"><div class="rotulo">Motorista</div><div class="valor">${escapeHtml(ordem.motorista_nome || 'N/A')}</div></div>
      <div class="item"><div class="rotulo">Veiculo</div><div class="valor">${escapeHtml(ordem.placa_veiculo || 'N/A')}</div></div>
      <div class="item"><div class="rotulo">Data</div><div class="valor">${formatarDataServidor(new Date().toISOString())}</div></div>
      <div class="item"><div class="rotulo">Peso total</div><div class="valor">${formatarPesoServidor(pesoTotal)}</div></div>
    </div>

    <h2>Fabricas a visitar</h2>
    ${blocos}

    ${ordem.observacoes ? `<div class="obs-carga"><div class="rotulo">Observacoes</div><div class="texto">${escapeHtml(ordem.observacoes)}</div></div>` : ''}
  </div>
</body>
</html>`;
}
