import { escapeHtml } from '../utils/html.js';
import { formatarMoedaServidor, formatarPesoServidor, formatarDataServidor } from '../utils/formatters.js';

function nfComQuebra(notaFiscal) {
  return (notaFiscal || '')
    .split('/')
    .map((parte) => escapeHtml(parte.trim()))
    .filter(Boolean)
    .join('<br>');
}

export function renderRelatorioFaturamento({ carga, entregas, destinoPrincipal }) {
  let pesoTotal = 0;
  let freteTotal = 0;

  const linhas = entregas.map((e) => {
    pesoTotal += e.peso_bruto || 0;
    freteTotal += e.valor_frete || 0;
    return `
      <tr>
        <td>${escapeHtml(e.cliente_razao_social || 'N/A')}</td>
        <td>${nfComQuebra(e.nota_fiscal)}</td>
        <td>${escapeHtml(e.unidade_nome || '')}</td>
        <td>${escapeHtml(e.tipo_cte_descricao || '')}</td>
        <td>${escapeHtml(e.forma_pagamento_descricao || '')}</td>
        <td>${escapeHtml(e.tipo_pagamento || '')}</td>
        <td>${formatarPesoServidor(e.peso_bruto)}</td>
        <td>${formatarMoedaServidor(e.valor_tonelada)}</td>
        <td>${formatarMoedaServidor(e.valor_frete)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatorio de Faturamento - ${escapeHtml(carga.codigo_carga)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; }
    .cabecalho { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .totais { margin-top: 12px; font-weight: bold; }
    .no-print { margin-bottom: 16px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir</button></div>
  <h1>Relatorio de Faturamento - ${escapeHtml(carga.codigo_carga)}</h1>
  <div class="cabecalho">
    <span>Origem: ${escapeHtml(carga.origem)}</span>
    <span>Destino: ${escapeHtml(destinoPrincipal)}</span>
    <span>Motorista: ${escapeHtml(carga.motorista_nome || 'N/A')}</span>
    <span>Veiculo: ${escapeHtml(carga.placa_veiculo || 'N/A')}</span>
    <span>Rota manifesto: ${escapeHtml(carga.rota_manifesto || '')}</span>
    <span>Vale pedagio: ${escapeHtml(carga.vale_pedagio_marca || '')} ${escapeHtml(carga.vale_pedagio_rota || '')} (${carga.vale_pedagio_eixos || 0} eixos)</span>
    <span>Frete pago ao motorista: ${formatarMoedaServidor(carga.frete_pago)}</span>
    <span>Adiantamento (${carga.adiantamento_percentual || 0}%): ${formatarMoedaServidor(carga.adiantamento_valor)}</span>
    <span>Data: ${formatarDataServidor(new Date().toISOString())}</span>
  </div>

  ${carga.observacoes_faturamento ? `<p><strong>Observacoes:</strong> ${escapeHtml(carga.observacoes_faturamento)}</p>` : ''}

  <table>
    <thead>
      <tr>
        <th>Cliente</th><th>NF</th><th>Unidade</th><th>Tipo CT-e</th><th>Forma Pgto</th><th>Tipo Pgto</th>
        <th>Peso</th><th>R$/Ton</th><th>Frete</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>

  <p class="totais">Peso total: ${formatarPesoServidor(pesoTotal)} | Frete total: ${formatarMoedaServidor(freteTotal)}</p>
</body>
</html>`;
}
