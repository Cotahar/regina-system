export function renderAvariasPage() {
  return `
    <div id="view-lista">
      <h1 class="text-xl font-semibold">Avarias</h1>

      <form id="form-filtros" class="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <input type="text" id="f-nf" class="input-field" placeholder="Nota fiscal">
        <select id="f-status" class="input-field">
          <option value="">Status (todos)</option>
          <option value="Pendente">Pendente</option>
          <option value="Enviado">Enviado</option>
          <option value="Finalizada">Finalizada</option>
        </select>
        <select id="f-marca" class="input-field"><option value="">Marca (todas)</option></select>
        <input list="lista-clientes-av" id="f-cliente-input" class="input-field" placeholder="Cliente...">
        <input type="hidden" id="f-cliente-id">
        <input list="lista-motoristas-av" id="f-motorista-input" class="input-field" placeholder="Motorista...">
        <input type="hidden" id="f-motorista-id">
        <input type="date" id="f-data-inicio" class="input-field">
        <input type="date" id="f-data-fim" class="input-field">
        <button type="submit" class="btn-primary">Buscar</button>
      </form>
      <datalist id="lista-clientes-av"></datalist>
      <datalist id="lista-motoristas-av"></datalist>

      <div id="lista-avarias" class="mt-4 space-y-3"></div>
    </div>

    <div id="view-registro" class="hidden">
      <h1 class="text-xl font-semibold">Registrar Avaria - <span id="reg-codigo-carga"></span></h1>
      <form id="form-registro" class="card mt-4 space-y-3">
        <div>
          <label class="mb-1 block text-xs text-slate-400">Entrega / Nota fiscal</label>
          <select id="reg-entrega" class="input-field" required></select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-slate-400">Marca</label>
            <select id="reg-marca" class="input-field" required></select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-400">Tipo de descarga</label>
            <select id="reg-tipo-descarga" class="input-field">
              <option value="Manual">Manual</option>
              <option value="Empilhadeira">Empilhadeira</option>
              <option value="Munck">Munck</option>
              <option value="Grua">Grua</option>
            </select>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-400">Itens avariados</label>
          <div id="reg-itens" class="space-y-2"></div>
          <button type="button" id="btn-add-item" class="btn-secondary mt-2 px-2 py-1 text-xs">+ Item</button>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-400">Fotos</label>
          <input type="file" id="reg-fotos" accept="image/*" multiple class="input-field">
          <div id="reg-progresso" class="mt-1 hidden h-2 rounded bg-painel-border">
            <div id="reg-progresso-barra" class="h-2 rounded bg-destaque" style="width:0%"></div>
          </div>
        </div>

        <p id="reg-msg" class="hidden text-sm"></p>
        <div class="flex gap-2">
          <button type="button" id="btn-voltar-lista" class="btn-secondary">Voltar</button>
          <button type="submit" class="btn-primary">Registrar</button>
        </div>
      </form>
    </div>

    <div id="modal-envio" class="fixed inset-0 z-20 hidden items-center justify-center bg-black/60">
      <form id="form-envio" class="card w-full max-w-md">
        <h3 class="mb-3 text-base font-semibold">Registrar envio para a fabrica</h3>
        <input type="hidden" id="envio-avaria-id">
        <textarea id="envio-texto" class="input-field" rows="3" placeholder="Protocolo / e-mail enviado..." required></textarea>
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="btn-secondary btn-fechar-modal">Cancelar</button>
          <button type="submit" class="btn-primary">Confirmar</button>
        </div>
      </form>
    </div>

    <div id="modal-finalizar" class="fixed inset-0 z-20 hidden items-center justify-center bg-black/60">
      <form id="form-finalizar" class="card w-full max-w-md">
        <h3 class="mb-3 text-base font-semibold">Finalizar avaria</h3>
        <input type="hidden" id="finalizar-avaria-id">
        <textarea id="finalizar-retorno" class="input-field mb-3" rows="3" placeholder="Retorno da fabrica..." required></textarea>
        <input type="text" id="finalizar-valor" class="input-field" placeholder="Valor de cobranca (R$), se houver">
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="btn-secondary btn-fechar-modal">Cancelar</button>
          <button type="submit" class="btn-primary">Confirmar</button>
        </div>
      </form>
    </div>
  `;
}
