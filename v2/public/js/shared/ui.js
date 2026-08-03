export function exibirMensagem(elemento, texto, tipo = 'sucesso') {
  elemento.textContent = texto;
  elemento.classList.remove('hidden', 'text-emerald-400', 'text-red-400');
  elemento.classList.add(tipo === 'erro' ? 'text-red-400' : 'text-emerald-400');
  clearTimeout(elemento._timeoutId);
  elemento._timeoutId = setTimeout(() => elemento.classList.add('hidden'), 5000);
}

export function abrirModal(modalEl) {
  modalEl.classList.remove('hidden');
}

export function fecharModal(modalEl) {
  modalEl.classList.add('hidden');
}
