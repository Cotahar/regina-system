// Autorizacao unica do Gmail (rodar so uma vez, ou de novo se o refresh token
// expirar/for revogado). Abre um servidor local temporario so pra capturar o
// redirect do Google - nao precisa copiar/colar codigo manualmente.
//
// Uso: npm run gmail:oauth-setup
// (GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET precisam estar no .env antes de rodar)

import http from 'node:http';
import { google } from 'googleapis';

const PORTA = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORTA}`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET precisam estar definidos (no .env local) antes de rodar este script.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [SCOPE]
});

console.log('\nAbra esta URL no navegador, logado como a conta frottex.notasfiscais@gmail.com, e autorize o acesso:\n');
console.log(authUrl);
console.log('\nAguardando autorizacao...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const erro = url.searchParams.get('error');

  if (erro) {
    res.end('Autorizacao negada. Pode fechar esta aba.');
    console.error(`Autorizacao negada pelo Google: ${erro}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.end('Nenhum codigo recebido. Pode fechar esta aba.');
    return;
  }

  res.end('Autorizado! Pode fechar esta aba e voltar ao terminal.');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.error(
        '\nO Google nao devolveu um refresh token (isso acontece quando a conta ja autorizou este app antes).' +
        '\nRevogue o acesso em https://myaccount.google.com/permissions (procure o app e remova) e rode este script de novo.'
      );
      process.exit(1);
    }
    console.log('\nAutorizacao concluida! Adicione esta linha ao seu .env:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    process.exit(0);
  } catch (err) {
    console.error('Erro trocando o codigo por token:', err.message);
    process.exit(1);
  }
});

server.listen(PORTA);
