# Cata Preço+

Aplicação web para catalogar produtos de sites de fornecedores autorizados, acompanhar o progresso e exportar os resultados em XLSX ou JSON.

## Limites honestos

- O projeto não burla CAPTCHA, login, WAF ou mecanismo antirobô. Ao detectar um bloqueio, encerra a execução com estado `blocked` e preserva os produtos já recebidos.
- A função da Vercel tem limite de tempo, memória e uso mensal. Uma execução percorre no máximo 35 páginas, 500 produtos ou 240 segundos. Para catálogos maiores, execute uma categoria por vez.
- O cancelamento interrompe a conexão e fecha o navegador assim que o servidor recebe a desconexão. Os itens já transmitidos continuam disponíveis para exportação no navegador.
- O crawler permanece no mesmo domínio informado e bloqueia IPs locais/privados para evitar SSRF.
- Respeite os termos do fornecedor, `robots.txt`, direitos autorais e legislação aplicável.

## Executar localmente

Requer Node.js 20 ou mais recente.

```bash
npm install
npm test
npm run check
npm run dev
```

Abra `http://localhost:3000`.

## Publicar com GitHub + Vercel

1. Crie um repositório vazio no GitHub.
2. Nesta pasta, execute `git init`, `git add .`, `git commit -m "Cata Preço+"` e envie a branch para o GitHub.
3. Na Vercel, escolha **Add New → Project**, importe o repositório e mantenha o framework como **Other**.
4. Publique. A Vercel reconhecerá `public/`, `api/` e `vercel.json`.
5. Depois do deploy, abra a URL gerada e execute o roteiro de aceitação abaixo em um site no qual você tenha autorização.

## Bloqueio de publicação

Não descreva uma versão como pronta apenas porque o ZIP abre ou os testes unitários passam. Antes de publicar uma versão, todos os itens abaixo precisam ter evidência:

- `npm test` e `npm run check` aprovados.
- Interface aberta em navegador real, sem erro no console.
- Campos obrigatórios e URL inválida testados.
- Iniciar, receber progresso, cancelar e preservar produtos testados.
- Estado de CAPTCHA/bloqueio testado e nunca exibido como concluído.
- Página de categoria não exportada como produto.
- Produto sem preço não contado como sucesso.
- Exportações XLSX e JSON abertas e conferidas com as sete colunas exatas.
- Deploy de prévia da Vercel testado antes de promover para produção.
- Scraping real testado separadamente em cada fornecedor suportado; aprovação em HTML simulado não substitui o teste ao vivo.

Se qualquer item não puder ser executado, a entrega deve dizer **não validado** e não pode afirmar “100% funcionando”.

## Estrutura

- `public/index.html`: interface e cliente de streaming.
- `api/scrape.js`: função Node.js/Playwright.
- `api/export.js`: exportação XLSX segura com ExcelJS.
- `lib/`: segurança, parser e crawler testáveis.
- `tests/`: regressões de preço, produto/categoria, CAPTCHA e SSRF.

Referências: [Vercel Functions](https://vercel.com/docs/functions), [Streaming](https://vercel.com/docs/functions/streaming-functions), [@sparticuz/chromium](https://github.com/Sparticuz/chromium).
