# Implantação na Hostinger

## Configuração da aplicação Node.js

- Configuração predefinida: `Other`
- Branch: `main`
- Versão do Node: `22.x`
- Diretório raiz: `./`
- Comando de construção: `npm run build`
- Gerenciador de pacotes: `npm`
- Diretório de saída: `dist`
- Arquivo de entrada: `server.js`

## Banco de dados

Crie um banco MySQL no hPanel da Hostinger e adicione estas variáveis de ambiente:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nome_do_banco
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco
ADMIN_EMAIL=email_do_administrador
ADMIN_PASSWORD=senha_forte_do_administrador
SESSION_SECRET=chave_longa_e_aleatoria
```

As tabelas são criadas automaticamente na primeira inicialização.
