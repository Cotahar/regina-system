import { escapeHtml } from '../utils/html.js';
import { formatarPesoServidor, formatarMoedaServidor, formatarDataServidor } from '../utils/formatters.js';

function formatarCnpjServidor(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj || '-';
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatarChaveAcesso(chave) {
  if (!chave || chave.length !== 44) return chave || '-';
  return chave.match(/.{1,4}/g).join(' ');
}

// Visualizacao gerada a partir dos campos que ja extraimos do XML, pra notas
// que chegaram sem o PDF/DANFE anexado (so XML). Nao e o DANFE oficial (esse
// exige o layout completo definido pela Receita, com codigo de barras
// valido etc.) - e so uma conferencia rapida dos dados, deixada clara no
// aviso no topo pra ninguem confundir com o documento fiscal de verdade.
export function renderNotaFiscalPdf({ nota }) {
  const contato = nota.ddd_destinatario && nota.telefone_destinatario
    ? `(${escapeHtml(nota.ddd_destinatario)}) ${escapeHtml(nota.telefone_destinatario)}`
    : (nota.telefone_destinatario ? escapeHtml(nota.telefone_destinatario) : '-');
  const cidadeUfDestinatario = [nota.cidade_destinatario, nota.estado_destinatario].filter(Boolean).join(' - ') || '-';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Nota Fiscal ${escapeHtml(nota.numero_nf || nota.id)}</title>
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
    .pagina { max-width: 800px; margin: 0 auto; padding: 0 20px 24px; }
    .no-print { padding: 12px 20px 0; }
    .no-print button { background: var(--amarelo); color: var(--preto); border: none; border-radius: 6px; padding: 8px 16px; font-weight: bold; font-size: 13px; cursor: pointer; }
    @media print { .no-print { display: none; } .pagina { max-width: none; padding: 0 8px; } }

    .header-band { background: var(--preto); color: #fff; padding: 16px 20px; margin: 12px 0 16px; border-radius: 8px; display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .header-band .marca { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--amarelo); font-weight: bold; }
    .header-band h1 { font-size: 20px; margin: 2px 0 0; }

    .aviso { background: #fefce8; border: 1px solid #fde047; border-left: 4px solid var(--amarelo); border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; color: #854d0e; }

    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px; background: var(--cinza-fundo); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .info-grid .item .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .info-grid .item .valor { font-size: 13px; font-weight: bold; color: var(--preto); }
    .info-grid .item.chave .valor { font-size: 11px; font-weight: normal; font-family: 'Courier New', monospace; letter-spacing: 0.02em; }

    h2 { font-size: 13px; color: var(--preto); border-left: 5px solid var(--amarelo); padding-left: 8px; margin: 18px 0 8px; }

    .bloco-parte { border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
    .bloco-parte .nome { font-size: 13px; font-weight: bold; color: var(--preto); }
    .bloco-parte .linha { margin-top: 4px; display: flex; gap: 18px; flex-wrap: wrap; }
    .bloco-parte .linha .item .rotulo { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .bloco-parte .linha .item .valor { font-size: 12px; color: var(--cinza-texto); }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>
  <div class="pagina">
    <div class="header-band">
      <div>
        <div class="marca">Frottex &middot; B. Nunes</div>
        <h1>Nota Fiscal ${escapeHtml(nota.numero_nf || '-')}</h1>
      </div>
    </div>

    <div class="aviso">
      Documento gerado automaticamente a partir dos dados do XML da NF-e recebida por e-mail (essa nota chegou sem o PDF/DANFE em anexo). <strong>Nao substitui o DANFE oficial</strong> - use so pra conferencia rapida dos dados.
    </div>

    <div class="info-grid">
      <div class="item"><div class="rotulo">Numero NF</div><div class="valor">${escapeHtml(nota.numero_nf || '-')}</div></div>
      <div class="item"><div class="rotulo">Data de emissao</div><div class="valor">${nota.data_emissao ? formatarDataServidor(nota.data_emissao) : '-'}</div></div>
      <div class="item"><div class="rotulo">Valor total (NF)</div><div class="valor">${nota.valor_total ? formatarMoedaServidor(nota.valor_total) : '-'}</div></div>
      <div class="item"><div class="rotulo">Peso bruto</div><div class="valor">${nota.peso_bruto ? formatarPesoServidor(nota.peso_bruto) : '-'}</div></div>
      <div class="item"><div class="rotulo">Placa do veiculo</div><div class="valor">${escapeHtml(nota.placa_veiculo || '-')}</div></div>
      <div class="item"><div class="rotulo">Motorista</div><div class="valor">${escapeHtml(nota.nome_motorista || '-')}</div></div>
      <div class="item chave" style="grid-column: span 3;"><div class="rotulo">Chave de acesso</div><div class="valor">${formatarChaveAcesso(nota.chave_acesso)}</div></div>
    </div>

    <h2>Emitente</h2>
    <div class="bloco-parte">
      <div class="nome">${escapeHtml(nota.nome_emitente || 'N/A')}</div>
      <div class="linha">
        <div class="item"><div class="rotulo">CNPJ</div><div class="valor">${formatarCnpjServidor(nota.cnpj_emitente)}</div></div>
      </div>
    </div>

    <h2>Destinatario</h2>
    <div class="bloco-parte">
      <div class="nome">${escapeHtml(nota.nome_destinatario || 'N/A')}</div>
      <div class="linha">
        <div class="item"><div class="rotulo">CNPJ</div><div class="valor">${formatarCnpjServidor(nota.cnpj_destinatario)}</div></div>
        <div class="item"><div class="rotulo">Cidade/UF</div><div class="valor">${escapeHtml(cidadeUfDestinatario)}</div></div>
        <div class="item"><div class="rotulo">Contato</div><div class="valor">${contato}</div></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
