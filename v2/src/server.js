import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionMiddleware } from './middleware/session.js';
import { requireLogin } from './middleware/auth.js';
import { authRouter } from './routes/auth.routes.js';
import { pagesRouter } from './routes/pages.routes.js';
import { motoristasRouter } from './routes/motoristas.routes.js';
import { veiculosRouter } from './routes/veiculos.routes.js';
import { marcasRouter } from './routes/marcas.routes.js';
import { auxiliaresRouter } from './routes/auxiliares.routes.js';
import { clientesRouter } from './routes/clientes.routes.js';
import { cargasRouter } from './routes/cargas.routes.js';
import { entregasRouter } from './routes/entregas.routes.js';
import { gerenciarCargaRouter } from './routes/gerenciarCarga.routes.js';
import { avariasRouter } from './routes/avarias.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', requireLogin, express.static(path.join(__dirname, '..', 'uploads')));

app.use(authRouter);
app.use(motoristasRouter);
app.use(veiculosRouter);
app.use(marcasRouter);
app.use(auxiliaresRouter);
app.use(clientesRouter);
app.use(cargasRouter);
app.use(entregasRouter);
app.use(gerenciarCargaRouter);
app.use(avariasRouter);
app.use(usuariosRouter);
app.use(pagesRouter);

app.use((req, res) => {
  res.status(404).send('Pagina nao encontrada');
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Regina System (v2) rodando em http://localhost:${PORT}`);
});
