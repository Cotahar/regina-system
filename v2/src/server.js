import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionMiddleware } from './middleware/session.js';
import { requireLogin } from './middleware/auth.js';
import { notificarAposMutacao } from './middleware/notificar.js';
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
import { registrarClienteSSE, removerClienteSSE } from './services/eventos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(notificarAposMutacao);

const uploadsRoot = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', requireLogin, express.static(uploadsRoot));

app.get('/api/eventos', requireLogin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  registrarClienteSSE(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removerClienteSSE(res);
  });
});

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
  console.log(`Frottex - B. Nunes (v2) rodando em http://localhost:${PORT}`);
});
