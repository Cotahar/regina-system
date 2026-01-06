from google_auth_oauthlib.flow import InstalledAppFlow
import os

# Define que queremos permissão para LER e ESCREVER arquivos
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    if not os.path.exists('client_secret.json'):
        print("ERRO: O arquivo 'client_secret.json' não foi encontrado.")
        print("Baixe-o do Google Cloud e coloque na mesma pasta deste script.")
        return

    flow = InstalledAppFlow.from_client_secrets_file(
        'client_secret.json', SCOPES)
    
    # Isso vai abrir o navegador para você logar
    creds = flow.run_local_server(port=0)

    # Salva o token mágico
    with open('token.json', 'w') as token:
        token.write(creds.to_json())
    
    print("\nSUCESSO! O arquivo 'token.json' foi criado.")
    print("Agora copie o CONTEÚDO deste arquivo para colocar no Railway.")

if __name__ == '__main__':
    main()