import { escapeHtml } from '../utils/html.js';
import { formatarPesoServidor, formatarDataServidor } from '../utils/formatters.js';

export function renderEspelhoCarga({ carga, entregasAgrupadas, coletasPorRemetente, pesoTotal }) {
  const linhasEntregas = entregasAgrupadas.map((e) => `
    <tr><td>${escapeHtml(e.cliente)}</td><td>${escapeHtml(e.cidadeUf)}</td><td>${formatarPesoServidor(e.peso)}</td></tr>
  `).join('');

  const blocosColeta = coletasPorRemetente.map(([remetente, dados]) => `
    <div class="coleta">
      <h3>Coleta: ${escapeHtml(remetente)} (${formatarPesoServidor(dados.totalPeso)})</h3>
      <table>
        <thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Peso</th></tr></thead>
        <tbody>
          ${dados.entregas.map((e) => `<tr><td>${escapeHtml(e.cliente)}</td><td>${escapeHtml(e.cidadeUf)}</td><td>${formatarPesoServidor(e.peso)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Espelho da Carga ${escapeHtml(carga.codigo_carga)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; }
    .cabecalho { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .coleta { margin-bottom: 16px; }
    .no-print { margin-bottom: 16px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir</button></div>
  <h1>Espelho de Carga - ${escapeHtml(carga.codigo_carga)}</h1>
  <div class="cabecalho">
    <span>Origem: ${escapeHtml(carga.origem)}</span>
    <span>Motorista: ${escapeHtml(carga.motorista_nome || 'N/A')}</span>
    <span>Veiculo: ${escapeHtml(carga.placa_veiculo || 'N/A')}</span>
    <span>Data: ${formatarDataServidor(new Date().toISOString())}</span>
  </div>

  <h2>Entregas por destino (peso total: ${formatarPesoServidor(pesoTotal)})</h2>
  <table>
    <thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Peso</th></tr></thead>
    <tbody>${linhasEntregas}</tbody>
  </table>

  <h2>Coletas por remetente</h2>
  ${blocosColeta}
</body>
</html>`;
}
