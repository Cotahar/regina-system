// Importa o JSON gerado por ../../../exportar_para_node.py (rodado no projeto
// Python) para o banco SQLite novo. Rode depois de "npm run db:migrate".
// Operacao espelho: limpa e reimporta as tabelas de origem-Python por inteiro.
//
// Uso: node src/db/import-from-python.js [caminho-do-json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';
import { importarDadosPython } from './importarPython.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const caminhoArg = args.find((a) => !a.startsWith('--'));

const candidatos = [
  caminhoArg,
  path.join(__dirname, '..', '..', 'export_dados.json'),
  path.join(__dirname, '..', '..', '..', 'export_dados.json')
].filter(Boolean);

const caminho = candidatos.find((p) => fs.existsSync(p));
if (!caminho) {
  console.error('Arquivo export_dados.json nao encontrado. Rode exportar_para_node.py primeiro e copie o arquivo para v2/ ou para a raiz do projeto.');
  process.exit(1);
}

const dados = JSON.parse(fs.readFileSync(caminho, 'utf-8'));

let resumo;
try {
  resumo = importarDadosPython(db, dados);
} catch (err) {
  console.error('Falha na importacao, nada foi gravado:', err.message);
  process.exit(1);
}

for (const [tabela, quantidade] of Object.entries(resumo)) {
  if (tabela === 'avaria_fotos_drive_nao_importadas') continue;
  console.log(`Importado: ${quantidade} registro(s) em ${tabela}`);
}

if (resumo.avaria_fotos_drive_nao_importadas) {
  console.log(`\nAviso: ${resumo.avaria_fotos_drive_nao_importadas} foto(s) de avaria existiam no Google Drive do sistema antigo.`);
  console.log('Elas NAO foram importadas (o sistema novo guarda fotos localmente em uploads/avarias/).');
  console.log('Baixe manualmente do Drive as fotos que ainda sejam relevantes, se precisar.');
}

console.log('\nImportacao concluida.');
