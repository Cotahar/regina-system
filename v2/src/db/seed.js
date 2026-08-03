import { db } from './connection.js';
import { hashPassword } from '../services/password.js';

function seedSimpleTable(table, column, values) {
  const { c } = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
  if (c > 0) return;
  const insert = db.prepare(`INSERT INTO ${table} (${column}) VALUES (?)`);
  for (const v of values) insert.run(v);
  console.log(`Seed: ${values.length} registro(s) criado(s) em ${table}.`);
}

export function seed() {
  seedSimpleTable('marcas', 'nome', ['ELIANE', 'PORTINARI', 'PORTOBELLO', 'INCEPA', 'CEUSA', 'ELIZABETH']);
  seedSimpleTable('tipos_cte', 'descricao', ['4 - SC', '17 - SC', '1 - SC', '11 - PR']);
  seedSimpleTable('formas_pagamento', 'descricao', [
    '15 DIAS', '28 DIAS', '30 DIAS', '30/60/90 DIAS', '30/60 DIAS', '30/45/60 DIAS', '30/45 DIAS'
  ]);

  const unidades = db.prepare('SELECT COUNT(*) as c FROM unidades').get();
  if (unidades.c === 0) {
    const insert = db.prepare('INSERT INTO unidades (nome, is_matriz) VALUES (?, ?)');
    ['MATRIZ SC', 'FILIAL PR', 'FILIAL ES', 'FILIAL RS', 'FILIAL MA'].forEach((nome, i) => {
      insert.run(nome, i === 0 ? 1 : 0);
    });
    console.log('Seed: unidades padrao criadas.');
  }

  const usuarios = db.prepare('SELECT COUNT(*) as c FROM usuarios').get();
  if (usuarios.c === 0) {
    db.prepare('INSERT INTO usuarios (nome_usuario, senha_hash, permissao) VALUES (?, ?, ?)')
      .run('admin', hashPassword('admin123'), 'admin');
    console.log('Seed: usuario "admin" criado com senha "admin123" - troque assim que possivel.');
  }
}
