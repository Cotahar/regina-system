// Escuta mudancas feitas por outros usuarios (via SSE) e chama o callback para
// recarregar a tela. Reconecta sozinho se a conexao cair.
export function ouvirMudancas(callback) {
  let fonte = null;

  function conectar() {
    fonte = new EventSource('/api/eventos');
    fonte.onmessage = () => callback();
    fonte.onerror = () => {
      fonte.close();
      setTimeout(conectar, 5000);
    };
  }

  conectar();
}
