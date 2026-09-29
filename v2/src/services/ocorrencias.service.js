import { db } from '../db/connection.js';

// Registra um evento na linha do tempo de uma carga - usado tanto pelas
// notas manuais quanto pelos eventos automaticos (troca de motorista/
// veiculo, mudanca de status). E so um INSERT, nunca edita/apaga nada -
// o historico tem que ficar intacto pra todo mundo confiar nele.
export function registrarOcorrencia(cargaId, texto, usuarioNome, tipo = 'automatico') {
  db.prepare('INSERT INTO ocorrencias_carga (carga_id, tipo, texto, usuario_nome) VALUES (?, ?, ?, ?)')
    .run(cargaId, tipo, texto, usuarioNome || null);
}

// So os dois eventos que o usuario pediu pra registrar sozinho por
// enquanto: troca de motorista/veiculo e mudanca de status. Comparado
// antes do UPDATE rodar, pra saber o que realmente mudou (nao so o que foi
// enviado - o campo pode vir no payload com o mesmo valor de antes).
// Centralizado aqui (em vez de vivar dentro de uma unica rota) porque mais
// de um endpoint muda motorista/veiculo/status de uma carga (o modal
// principal E o Gerenciar Faturamento) - os dois precisam gerar o mesmo
// registro automatico, senao a linha do tempo fica incompleta dependendo
// de por onde a alteracao foi feita.
export function detectarEventosAutomaticos(cargaAntes, data) {
  const eventos = [];

  if ('status' in data && data.status && data.status !== cargaAntes.status) {
    eventos.push(`Status alterado de "${cargaAntes.status}" para "${data.status}"`);
  }

  if ('motorista_id' in data) {
    const novoId = data.motorista_id ? Number(data.motorista_id) : null;
    const antigoId = cargaAntes.motorista_id || null;
    if (novoId !== antigoId) {
      const nomeAntigo = antigoId ? db.prepare('SELECT nome FROM motoristas WHERE id = ?').get(antigoId)?.nome : null;
      const nomeNovo = novoId ? db.prepare('SELECT nome FROM motoristas WHERE id = ?').get(novoId)?.nome : null;
      eventos.push(`Motorista alterado de "${nomeAntigo || 'nenhum'}" para "${nomeNovo || 'nenhum'}"`);
    }
  }

  if ('veiculo_id' in data) {
    const novoId = data.veiculo_id ? Number(data.veiculo_id) : null;
    const antigoId = cargaAntes.veiculo_id || null;
    if (novoId !== antigoId) {
      const placaAntiga = antigoId ? db.prepare('SELECT placa FROM veiculos WHERE id = ?').get(antigoId)?.placa : null;
      const placaNova = novoId ? db.prepare('SELECT placa FROM veiculos WHERE id = ?').get(novoId)?.placa : null;
      eventos.push(`Veiculo alterado de "${placaAntiga || 'nenhum'}" para "${placaNova || 'nenhum'}"`);
    }
  }

  return eventos;
}
