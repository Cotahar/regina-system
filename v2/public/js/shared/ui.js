export function exibirMensagem(elemento, texto, tipo = 'sucesso') {
  elemento.textContent = texto;
  elemento.classList.remove('hidden', 'text-emerald-400', 'text-red-400');
  elemento.classList.add(tipo === 'erro' ? 'text-red-400' : 'text-emerald-400');
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

// Faz a textarea crescer/encolher com o conteudo em vez de ficar fixa com
// scroll interno. Retorna a funcao de ajuste pra poder chamar de novo depois
// de setar .value programaticamente (isso nao dispara o evento 'input').
export function ativarAutoResize(textarea) {
  const ajustar = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener('input', ajustar);
  ajustar();
  return ajustar;
}
