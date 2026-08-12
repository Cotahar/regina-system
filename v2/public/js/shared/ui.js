export function exibirMensagem(elemento, texto, tipo = 'sucesso') {
  elemento.textContent = texto;
  elemento.classList.remove('hidden', 'text-emerald-600', 'text-red-600');
  elemento.classList.add(tipo === 'erro' ? 'text-red-600' : 'text-emerald-600');
  clearTimeout(elemento._timeoutId);
  elemento._timeoutId = setTimeout(() => elemento.classList.add('hidden'), 5000);
}

export function abrirModal(modalEl) {
  modalEl.classList.remove('hidden');
  modalEl.classList.add('flex');
}

export function fecharModal(modalEl) {
  modalEl.classList.add('hidden');
  modalEl.classList.remove('flex');
}
