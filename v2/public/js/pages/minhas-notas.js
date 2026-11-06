import { apiGet } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarPeso, formatarData } from '../shared/format.js';

const tabela = document.getElementById('mn-tabela');
const contagem = document.getElementById('mn-contagem');
const busca = document.getElementById('mn-busca');

let notas = [];

function linha(n) {
  const cidadeUf = [n.cidade_destinatario, n.estado_destinatario].filter(Boolean).join('/');
  return `
    <tr class="border-t border-painel-border">
      <td class="py-1.5 px-1.5 font-medium">${escapeHtml(n.numero_nf || '-')}</td>
      <td class="py-1.5 px-1.5">${n.data_emissao ? formatarData(n.data_emissao) : '-'}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(n.nome_destinatario || '-')}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(cidadeUf || '-')}</td>
      <td class="py-1.5 px-1.5">${n.peso_bruto ? formatarPeso(n.peso_bruto) : '-'}</td>
      <td class="py-1.5 px-1.5 text-right">
        <a href="/representante/notas/${n.id}/pdf" target="_blank" rel="noopener" class="text-brand-yellow hover:underline">Ver PDF</a>
      </td>
    </tr>
  `;
}

function renderizar() {
  const termo = busca.value.trim().toLowerCase();
  const visiveis = termo
    ? notas.filter((n) => `${n.numero_nf || ''} ${n.nome_destinatario || ''} ${n.cidade_destinatario || ''} ${n.estado_destinatario || ''}`.toLowerCase().includes(termo))
    : notas;

  tabela.innerHTML = visiveis.map(linha).join('') ||
    '<tr><td colspan="6" class="py-4 text-center text-slate-400">Nenhuma nota encontrada.</td></tr>';
  contagem.textContent = `${visiveis.length} de ${notas.length} nota(s)`;
}

async function carregar() {
  try {
    ({ notas } = await apiGet('/api/representante/notas'));
    renderizar();
  } catch (err) {
    tabela.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-400">${escapeHtml(err.message)}</td></tr>`;
  }
}

busca.addEventListener('input', renderizar);
carregar();
