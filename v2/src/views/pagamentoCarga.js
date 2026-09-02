export function renderPagamentoCargaPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Envio de Pagamento - <span id="pag-codigo"></span></h1>
    </div>

    <div class="card mt-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="label">Motorista</label>
          <input id="pag-motorista" class="input-field" readonly>
        </div>
        <div>
          <label class="label">Tipo</label>
          <input id="pag-tipo" class="input-field" readonly>
        </div>
        <div>
          <label class="label">Unidade</label>
          <select id="pag-unidade" class="input-field"></select>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="label">Origem</label>
          <select id="pag-origem" class="input-field"></select>
        </div>
        <div>
          <label class="label">Destino</label>
          <select id="pag-destino" class="input-field"></select>
        </div>
      </div>

      <div id="pag-secao-frota" class="mt-4 hidden grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="label">Frete empresa</label>
          <input id="pag-frete-empresa" class="input-field" readonly>
        </div>
        <div>
          <label class="label">Peso</label>
          <input id="pag-peso" class="input-field" readonly>
        </div>
        <div>
          <label class="label">Frete motorista</label>
          <input id="pag-frete-motorista-frota" class="input-field" readonly>
        </div>
      </div>

      <div id="pag-secao-terceiro" class="mt-4 hidden">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label class="label">Nosso Frete</label>
            <input id="pag-nosso-frete" class="input-field" readonly>
          </div>
          <div>
            <label class="label">Frete Motorista</label>
            <input id="pag-frete-motorista" class="input-field" readonly>
          </div>
          <div>
            <label class="label">Adiantamento</label>
            <input id="pag-adiantamento" class="input-field" readonly>
          </div>
          <div>
            <label class="label">Saldo</label>
            <input id="pag-saldo" class="input-field">
          </div>
          <div>
            <label class="label">Vale Pedagio</label>
            <input id="pag-vale-pedagio" class="input-field">
          </div>
        </div>
        <div class="mt-3">
          <label class="label">Dados de pagamento</label>
          <textarea id="pag-dados-pagamento" class="input-field" rows="5" placeholder="Banco, agencia, conta, titular, PIX..."></textarea>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <label class="label">Mensagem</label>
      <textarea id="pag-preview" class="input-field whitespace-pre-wrap font-mono text-xs" rows="16" readonly></textarea>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" id="btn-pag-salvar" class="btn-success">Salvar</button>
        <button type="button" id="btn-pag-whatsapp" class="btn-primary">Enviar no WhatsApp</button>
        <button type="button" id="btn-pag-copiar" class="btn-secondary">Copiar mensagem</button>
        <button type="button" id="btn-pag-fechar" class="btn-secondary">Fechar</button>
      </div>
      <p id="pag-msg" class="mt-3 hidden text-sm"></p>
    </div>
  `;
}
