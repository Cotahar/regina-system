// Canal de notificacao em tempo real (Server-Sent Events) - nativo do Node/Express,
// sem dependencia nova. Quando alguem cria/edita/exclui uma carga ou entrega,
// todos os outros navegadores conectados recebem um aviso e se atualizam sozinhos.
const clientesConectados = new Set();

export function registrarClienteSSE(res) {
  clientesConectados.add(res);
}

export function removerClienteSSE(res) {
  clientesConectados.delete(res);
}

export function notificarMudanca(tipo = 'geral') {
  const payload = `data: ${JSON.stringify({ tipo, ts: Date.now() })}\n\n`;
  for (const res of clientesConectados) {
    try {
      res.write(payload);
    } catch {
      clientesConectados.delete(res);
    }
  }
}
