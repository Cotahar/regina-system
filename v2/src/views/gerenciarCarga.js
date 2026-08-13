export function renderGerenciarCargaPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Gerenciar / Faturamento - <span id="ger-codigo"></span></h1>
      <div class="flex gap-2">
        <button type="button" id="btn-imprimir" class="btn-secondary">Imprimir Relatorio</button>
        <button type="button" id="btn-salvar" class="btn-success">Salvar</button>
      </div>
    </div>

    <div class="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="relative">
        <label class="label">Motorista</label>
        <input id="ger-motorista-input" class="input-field">
        <input type="hidden" id="ger-motorista-id">
      </div>
      <div class="relative">
        <label class="label">Veiculo</label>
        <input id="ger-veiculo-input" class="input-field">
        <input type="hidden" id="ger-veiculo-id">
      </div>
      <div>
        <label class="label">Rota manifesto</label>
        <input type="text" id="ger-rota" class="input-field">
      </div>
      <div>
        <label class="label">Vale pedagio (marca)</label>
        <input type="text" id="ger-vp-marca" class="input-field" placeholder="Sem Parar / Move Mais">
      </div>
      <div>
        <label class="label">Vale pedagio (rota)</label>
        <input type="text" id="ger-vp-rota" class="input-field">
      </div>
      <div>
        <label class="label">Vale pedagio (eixos)</label>
        <input type="number" id="ger-vp-eixos" class="input-field">
      </div>
      <div>
        <label class="label">Frete pago (motorista)</label>
        <input type="text" id="ger-frete-pago" class="input-field">
      </div>
      <div>
        <label class="label">Adiantamento (%)</label>
        <input type="number" id="ger-adiant-percentual" class="input-field" value="70">
      </div>
      <div>
        <label class="label">Valor do adiantamento</label>
        <input type="text" id="ger-adiant-valor" class="input-field" readonly>
      </div>
      <div class="sm:col-span-2 lg:col-span-4">
        <label class="label">Observacoes de faturamento</label>
        <textarea id="ger-observacoes" class="input-field" rows="2"></textarea>
      </div>
    </div>

    <div class="card mt-4">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <button type="button" id="btn-agrupar" class="btn-secondary btn-sm">Agrupar selecionadas</button>
        <button type="button" id="btn-desagrupar" class="btn-secondary btn-sm">Desagrupar selecionadas</button>
        <button type="button" id="btn-excluir-selecionadas" class="btn-danger btn-sm">Excluir selecionadas</button>
        <span class="mx-1 h-6 border-l border-painel-border"></span>
        <select id="bulk-unidade" class="input-field w-40"><option value="">Unidade (massa)</option></select>
        <select id="bulk-tipo-cte" class="input-field w-40"><option value="">Tipo CT-e (massa)</option></select>
        <select id="bulk-forma-pgto" class="input-field w-40"><option value="">Forma Pgto (massa)</option></select>
        <select id="bulk-tipo-pgto" class="input-field w-36">
          <option value="">Tipo Pgto (massa)</option>
          <option value="Boleto">Boleto</option>
          <option value="Transferencia">Transferencia</option>
        </select>
        <button type="button" id="btn-aplicar-massa" class="btn-secondary btn-sm">Aplicar as selecionadas</button>
        <button type="button" id="btn-salvar-rapido" class="btn-success btn-sm">Salvar</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2"><input type="checkbox" id="ger-chk-todas"></th>
              <th class="pb-2">Remetente</th>
              <th class="pb-2">Cliente</th>
              <th class="pb-2">NF</th>
              <th class="pb-2">Unidade</th>
              <th class="pb-2">Tipo CT-e</th>
              <th class="pb-2">Peso</th>
              <th class="pb-2">Cubado</th>
              <th class="pb-2">R$/Ton</th>
              <th class="pb-2">Frete</th>
              <th class="pb-2">Forma Pgto</th>
              <th class="pb-2">Tipo Pgto</th>
              <th class="pb-2">Cortesia</th>
              <th class="pb-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody id="ger-tabela"></tbody>
          <tfoot class="border-t border-painel-border font-semibold text-slate-300">
            <tr>
              <td colspan="6" class="pt-2">Total geral:</td>
              <td class="pt-2" id="total-geral-peso">0,00 kg</td>
              <td class="pt-2" id="total-geral-cubado">0,00 kg</td>
              <td class="pt-2"></td>
              <td class="pt-2" id="total-geral-frete">R$ 0,00</td>
              <td colspan="3" class="pt-2"></td>
            </tr>
            <tr>
              <td colspan="6" class="pt-1">Total selecionadas:</td>
              <td class="pt-1" id="total-sel-peso">0,00 kg</td>
              <td class="pt-1" id="total-sel-cubado">0,00 kg</td>
              <td class="pt-1"></td>
              <td class="pt-1" id="total-sel-frete">R$ 0,00</td>
              <td colspan="3" class="pt-1"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <p id="ger-msg" class="mt-3 hidden text-sm"></p>

    <div id="modal-repasse" class="fixed inset-0 z-20 hidden items-center justify-center bg-slate-900/50">
      <form id="form-repasse" class="card w-full max-w-md">
        <h3 class="mb-3 text-base font-semibold">Repasse / comissao</h3>
        <input type="hidden" id="repasse-entrega-id">
        <div class="mb-3">
          <label class="label">Valor combinado (o que fica para a empresa)</label>
          <input type="text" id="repasse-valor-combinado" class="input-field" placeholder="Ex: 750,00 por ton, ou valor cheio">
        </div>
        <div class="mb-3">
          <label class="label">Repasse para (nome do representante/parceiro)</label>
          <input type="text" id="repasse-destinatario" class="input-field">
        </div>
        <p class="mb-3 text-xs text-slate-400">A diferenca entre o valor do frete cobrado no CT-e e o valor combinado e o que deve ser repassado.</p>
        <div class="flex justify-end gap-2">
          <button type="button" id="btn-cancelar-repasse" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-success">Salvar</button>
        </div>
      </form>
    </div>
  `;
}
