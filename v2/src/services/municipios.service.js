import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const arquivoMunicipios = path.join(__dirname, '..', '..', 'public', 'data', 'municipios-br.json');

function normalizar(texto) {
  return (texto || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// Indexado por nome normalizado (sem acento/caixa) -> lista de municipios
// com esse nome (pode ter mais de um Brasil afora, ex: varias "Bom Jesus").
// Um Map em vez de filtro linear porque isso roda pra cada linha de uma
// importacao e pra cada cadastro existente no backfill (milhares de linhas).
let indice = null;
function carregarIndice() {
  if (!indice) {
    const lista = JSON.parse(fs.readFileSync(arquivoMunicipios, 'utf-8'));
    indice = new Map();
    for (const linha of lista) {
      const [cidade, uf] = linha.split('|');
      const chave = normalizar(cidade);
      const item = { cidade, uf, chaveUf: uf.toUpperCase() };
      if (!indice.has(chave)) indice.set(chave, []);
      indice.get(chave).push(item);
    }
  }
  return indice;
}

// Tenta achar o municipio oficial mais provavel pro texto digitado/
// importado (usado pela importacao de clientes e pelo backfill de
// cadastros antigos) - sem acento/caixa, igual o combobox de cidade ja usa
// no navegador. Se a UF informada bate com algum municipio de mesmo nome,
// usa esse pra desempatar nomes repetidos em estados diferentes (ha varias
// "Bom Jesus" pelo Brasil); sem UF (ou UF que nao bate), so resolve quando
// o nome for unico. Nunca inventa - retorna null quando nao acha nada.
export function encontrarMunicipio(cidadeTexto, estadoTexto) {
  const chaveCidade = normalizar(cidadeTexto);
  if (!chaveCidade) return null;

  const candidatos = carregarIndice().get(chaveCidade);
  if (!candidatos) return null;

  const chaveUf = (estadoTexto || '').trim().toUpperCase();
  const doEstado = candidatos.find((m) => m.chaveUf === chaveUf);
  return doEstado || (candidatos.length === 1 ? candidatos[0] : null);
}
