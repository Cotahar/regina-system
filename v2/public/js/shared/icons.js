// Icones inline (sem dependencia externa) - estilo outline, 20x20, stroke
// currentColor para herdar a cor do texto do botao.
const svg = (paths) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0">${paths}</svg>`;

export const icones = {
  salvar: svg('<path d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M7 4v4h6V4"/><path d="M6 12h8v5H6z"/>'),
  calendario: svg('<rect x="3" y="4" width="14" height="13" rx="1.5"/><path d="M3 8h14M7 2.5v3M13 2.5v3"/>'),
  caminhao: svg('<path d="M2 6h9v8H2z"/><path d="M11 9h4l3 3v2h-7z"/><circle cx="6" cy="16" r="1.6"/><circle cx="15" cy="16" r="1.6"/>'),
  check: svg('<circle cx="10" cy="10" r="7.5"/><path d="M7 10l2 2 4-4"/>'),
  voltar: svg('<path d="M9 5l-5 5 5 5"/><path d="M4 10h12"/>'),
  impressora: svg('<path d="M6 3h8v4H6z"/><path d="M4 7h12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2v3H6v-3H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><rect x="6" y="12" width="8" height="5"/>'),
  cifrao: svg('<circle cx="10" cy="10" r="7.5"/><path d="M10 6v8M12.2 7.8c-.4-.6-1.2-1-2.2-1-1.3 0-2.3.7-2.3 1.7 0 2.3 4.6 1 4.6 3.2 0 1-1 1.7-2.3 1.7-1 0-1.8-.4-2.2-1"/>'),
  alerta: svg('<path d="M10 3l8.5 14.5H1.5L10 3z"/><path d="M10 8.5v3.2"/><circle cx="10" cy="14.2" r="0.15" fill="currentColor" stroke="none"/>'),
  lixeira: svg('<path d="M4 6h12M8 6V4h4v2M6 6l.7 10a1 1 0 0 0 1 1h4.6a1 1 0 0 0 1-1L14 6"/><path d="M8.5 9v5M11.5 9v5"/>'),
  duplicar: svg('<rect x="3" y="3" width="10" height="10" rx="1.2"/><path d="M7 13v2.8a1.2 1.2 0 0 0 1.2 1.2H16a1.2 1.2 0 0 0 1.2-1.2V8.2A1.2 1.2 0 0 0 16 7h-3"/>'),
  mensagem: svg('<path d="M3 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3v-3H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>')
};
