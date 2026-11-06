import { db } from '../db/connection.js';

export const PERMISSAO_REPRESENTANTE = 'representante';

// Perfil "representante" (parceiro que so enxerga as notas fiscais de UM
// remetente): diferente dos demais perfis, aqui vale lista de PERMITIDOS, nao
// de bloqueados - a maioria das rotas do sistema so exige estar logado, entao
// qualquer rota nova que alguem criar no futuro continua fechada pra ele sem
// precisar lembrar de proteger. So passa o que estiver nesta lista, com o
// metodo exato (HEAD conta como GET).
const ROTAS_LIBERADAS = [
  { metodo: 'GET', caminho: /^\/login$/ },
  { metodo: 'GET', caminho: /^\/primeiro-acesso$/ },
  { metodo: 'POST', caminho: /^\/api\/login$/ },
  { metodo: 'POST', caminho: /^\/api\/primeiro-acesso$/ },
  { metodo: 'GET', caminho: /^\/logout$/ },
  { metodo: 'GET', caminho: /^\/api\/session$/ },
  { metodo: 'GET', caminho: /^\/minhas-notas\.html$/ },
  { metodo: 'GET', caminho: /^\/api\/representante\/notas$/ },
  { metodo: 'GET', caminho: /^\/representante\/notas\/\d+\/pdf$/ }
];

function pedidoDeApi(req) {
  return req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json');
}

export function restringirRepresentante(req, res, next) {
  if (req.session?.permissao !== PERMISSAO_REPRESENTANTE) return next();

  const metodo = req.method === 'HEAD' ? 'GET' : req.method;
  if (ROTAS_LIBERADAS.some((r) => r.metodo === metodo && r.caminho.test(req.path))) return next();

  if (pedidoDeApi(req)) return res.status(403).json({ error: 'Acesso negado' });
  return res.redirect('/minhas-notas.html');
}

// Garante que quem chega nas rotas do representante e de fato um, e carrega o
// remetente vinculado a ele DO BANCO a cada pedido (nao da sessao) - assim,
// se o administrador trocar o remetente do usuario, vale na hora.
export function requireRepresentante(req, res, next) {
  if (req.session?.permissao !== PERMISSAO_REPRESENTANTE) {
    if (pedidoDeApi(req)) return res.status(403).json({ error: 'Acesso negado' });
    return res.redirect('/');
  }

  const vinculo = db.prepare(`
    SELECT c.id, c.razao_social, c.cnpj
    FROM usuarios u
    JOIN clientes c ON c.id = u.remetente_id
    WHERE u.id = ?
  `).get(req.session.userId);

  if (!vinculo) {
    const erro = 'Seu usuario ainda nao tem um remetente vinculado. Fale com o administrador.';
    if (pedidoDeApi(req)) return res.status(403).json({ error: erro });
    return res.status(403).send(erro);
  }

  req.remetente = {
    id: vinculo.id,
    nome: vinculo.razao_social,
    cnpj: (vinculo.cnpj || '').replace(/\D/g, '') || null
  };
  next();
}
