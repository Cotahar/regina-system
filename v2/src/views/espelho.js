import { escapeHtml } from '../utils/html.js';
import { formatarPesoServidor, formatarDataServidor } from '../utils/formatters.js';

function contatoTexto(perfil) {
  if (perfil.ddd && perfil.telefone) return `(${escapeHtml(perfil.ddd)}) ${escapeHtml(perfil.telefone)}`;
  if (perfil.telefone) return escapeHtml(perfil.telefone);
  return '-';
}

// Resumo compacto do perfil de atendimento do cliente (mesmas flags do
// cadastro) - pensado pra quem vai carregar/descarregar saber de antemao se
// precisa agendar, se tem ajudante no local, etc, sem precisar ligar pra
// confirmar.
function perfilLinha(perfil) {
  const tags = [];
  if (perfil.precisaAgendamento) tags.push('Descarga Agendada');
  if (perfil.autodescarga) tags.push('Descarga por conta do cliente');
  if (perfil.precisaAjudantes) tags.push('Precisa de ajudantes');
  if (perfil.descargaPagaDireto) tags.push('Descarga paga direto');
  if (perfil.resolveComRepresentante) tags.push('Resolver com representante');
  if (perfil.contatoExtra) tags.push(`Contato extra: ${escapeHtml(perfil.contatoExtra)}`);
  const badges = tags.map((t) => `<span class="badge">${t}</span>`).join('');
  const obs = perfil.observacoes ? `<div class="obs-cliente">Obs: ${escapeHtml(perfil.observacoes)}</div>` : '';
  return badges || obs ? `<div class="perfil-linha">${badges}</div>${obs}` : '';
}

export function renderEspelhoCarga({ carga, entregasAgrupadas, coletasPorRemetente, pesoTotal }) {
  const linhasEntregas = entregasAgrupadas.map((e) => `
    <tr>
      <td><strong>${escapeHtml(e.cliente)}</strong>${perfilLinha(e.perfil)}</td>
      <td>${escapeHtml(e.cidadeUf)}</td>
      <td>${contatoTexto(e.perfil)}</td>
      <td class="num">${formatarPesoServidor(e.peso)}</td>
    </tr>
  `).join('');

  // Nos blocos de coleta so interessa localizar a entrega (cliente/cidade/
  // contato) - o perfil de atendimento (agendamento, descarga, obs) so
  // aparece na Lista de Entregas, pra nao duplicar a mesma informacao.
  const blocosColeta = coletasPorRemetente.map(([remetente, dados]) => `
    <div class="coleta">
      <h3>Coleta: ${escapeHtml(remetente)} <span class="peso-coleta">(${formatarPesoServidor(dados.totalPeso)})</span></h3>
      <table>
        <thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Contato</th><th class="num">Peso</th></tr></thead>
        <tbody>
          ${dados.entregas.map((e) => `
            <tr>
              <td><strong>${escapeHtml(e.cliente)}</strong></td>
              <td>${escapeHtml(e.cidadeUf)}</td>
              <td>${contatoTexto(e.perfil)}</td>
              <td class="num">${formatarPesoServidor(e.peso)}</td>
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
  <title>Espelho da Carga ${escapeHtml(carga.codigo_carga)}</title>
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
    .header-band .frota-badge { background: var(--amarelo); color: var(--preto); font-weight: bold; font-size: 10px; letter-spacing: 0.04em; padding: 3px 10px; border-radius: 999px; align-self: center; }

    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px; background: var(--cinza-fundo); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
    .info-grid .item .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .info-grid .item .valor { font-size: 13px; font-weight: bold; color: var(--preto); }

    .obs-carga { background: #fefce8; border: 1px solid #fde047; border-left: 4px solid var(--amarelo); border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; }
    .obs-carga .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #854d0e; font-weight: bold; }
    .obs-carga .texto { margin-top: 2px; white-space: pre-wrap; }

    h2 { font-size: 14px; color: var(--preto); border-left: 5px solid var(--amarelo); padding-left: 8px; margin: 20px 0 8px; }
    h2 .peso-total { font-weight: normal; color: #6b7280; font-size: 12px; }
    h3 { font-size: 12.5px; color: var(--preto); background: var(--cinza-fundo); border-radius: 6px 6px 0 0; margin: 0; padding: 7px 10px; border: 1px solid var(--cinza-borda); border-bottom: none; }
    .peso-coleta { font-weight: normal; color: #6b7280; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    thead th { background: var(--preto); color: var(--amarelo); text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; padding: 6px 8px; }
    tbody td { border: 1px solid var(--cinza-borda); border-top: none; padding: 6px 8px; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.num, th.num { text-align: right; white-space: nowrap; }

    .badge { display: inline-block; background: #e0e7ff; color: #3730a3; border-radius: 999px; padding: 1px 7px; font-size: 9px; margin: 2px 4px 0 0; }
    .obs-cliente { font-size: 10px; color: #6b7280; margin-top: 2px; font-style: italic; }
    .perfil-linha { margin-top: 2px; }

    .coleta { margin-bottom: 16px; }
    .coleta table { margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir</button></div>
  <div class="pagina">
    <div class="header-band">
      <div>
        <div class="marca">Frottex &middot; B. Nunes</div>
        <h1>Espelho de Carga - ${escapeHtml(carga.codigo_carga)}</h1>
      </div>
      ${carga.veiculo_frota ? '<span class="frota-badge">FROTA</span>' : ''}
    </div>

    <div class="info-grid">
      <div class="item"><div class="rotulo">Origem</div><div class="valor">${escapeHtml(carga.origem)}</div></div>
      <div class="item"><div class="rotulo">Motorista</div><div class="valor">${escapeHtml(carga.motorista_nome || 'N/A')}</div></div>
      <div class="item"><div class="rotulo">Veiculo</div><div class="valor">${escapeHtml(carga.placa_veiculo || 'N/A')}</div></div>
      <div class="item"><div class="rotulo">Data</div><div class="valor">${formatarDataServidor(new Date().toISOString())}</div></div>
    </div>

    <h2>Lista de Entregas: <span class="peso-total">(peso total: ${formatarPesoServidor(pesoTotal)})</span></h2>
    <table>
      <thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Contato</th><th class="num">Peso</th></tr></thead>
      <tbody>${linhasEntregas}</tbody>
    </table>

    ${carga.observacoes ? `<div class="obs-carga"><div class="rotulo">Observacoes da carga</div><div class="texto">${escapeHtml(carga.observacoes)}</div></div>` : ''}

    <h2>Lista de Coletas: </h2>
    ${blocosColeta}
  </div>
</body>
</html>`;
}
