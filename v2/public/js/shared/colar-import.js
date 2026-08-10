import { apiPost } from './api.js';
import { exibirMensagem } from './ui.js';

// Alternativa ao upload de arquivo: colar linhas copiadas do Excel direto numa
// textarea, para adicionar poucos registros sem precisar gerar um CSV.
export function configurarColarImport({ textareaId, botaoId, msgId, url, onSucesso, precisaCabecalho = false }) {
  const msgEl = document.getElementById(msgId);
  document.getElementById(botaoId).addEventListener('click', async () => {
    const textarea = document.getElementById(textareaId);
    const texto = textarea.value.trim();
    if (!texto) return;

    // Alguns endpoints de import sempre pulam a primeira linha (cabecalho do CSV).
    // Como o texto colado nao tem cabecalho, adiciona uma linha vazia no lugar.
    const textoFinal = precisaCabecalho ? `cabecalho\n${texto}` : texto;

    const formData = new FormData();
    formData.append('arquivo', new Blob([textoFinal], { type: 'text/csv' }), 'colado.csv');

    try {
      const data = await apiPost(url, formData);
      textarea.value = '';
      exibirMensagem(msgEl, data.message, 'sucesso');
      await onSucesso?.();
    } catch (err) {
      exibirMensagem(msgEl, err.message, 'erro');
    }
  });
}
