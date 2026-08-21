# Cata Preço+

Sistema híbrido para catalogar produtos de fornecedores autorizados. O painel roda na Vercel, enquanto a extensão **Coletor Cata Preço+** abre uma aba real do Chrome, rola as páginas, usa a sessão do usuário e devolve os produtos ao painel para exportação em XLSX ou JSON.

## Limites honestos

- O projeto não burla CAPTCHA, login, WAF ou mecanismo antirobô. A extensão pausa, mantém a aba aberta e pede intervenção do usuário.
- A catalogação não depende mais do Chromium invisível da Vercel nem do limite de duração de uma função serverless.
- A fila, produtos e página atual são persistidos em `chrome.storage.local` para permitir recuperação após suspensão do service worker.
- O coletor permanece no mesmo domínio do fornecedor e só aceita comandos vindos do painel Cata Preço+.
- Respeite os termos do fornecedor, `robots.txt`, direitos autorais e legislação aplicável.

## Instalar o coletor

1. Abra o painel e clique em **Baixar coletor**.
2. Extraia o ZIP completamente.
3. Abra `chrome://extensions`.
4. Ative **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação**.
6. Selecione a pasta extraída que contém `manifest.json`. Não selecione o arquivo ZIP nem uma pasta acima dela.
7. Recarregue o painel. O estado precisa mudar para **Coletor conectado** antes de liberar “Iniciar pesquisa”.

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
- Exportações XLSX e JSON abertas e conferidas com as oito colunas exatas, incluindo o link direto do produto.
- Deploy de prévia da Vercel testado antes de promover para produção.
- Scraping real testado separadamente em cada fornecedor suportado; aprovação em HTML simulado não substitui o teste ao vivo.

Se qualquer item não puder ser executado, a entrega deve dizer **não validado** e não pode afirmar “100% funcionando”.

## Estrutura

- `public/index.html`: painel e ponte de comunicação com a extensão.
- `extension/`: extensão Chrome Manifest V3, coletor DOM e fila persistente.
- `public/downloads/coletor-cata-preco-plus-v1.3.0.zip`: pacote instalável gerado por `npm run build:extension`.

## Versão 1.3.0

- Captura imagens por `src`, `currentSrc`, `srcset` e atributos comuns de lazy-load.
- Exibe a miniatura do produto no catálogo e mantém o link original nas exportações.
- Abre e navega a aba coletora sem ativá-la, preservando a aba que o usuário está usando.
- Cataloga e exporta o link direto de cada produto.
- Remove o botão **Ver aba**; a aba do fornecedor pode ser aberta manualmente quando houver login ou CAPTCHA.
- `api/export.js`: exportação XLSX segura com ExcelJS.
- `tests/`: regressões do painel, extensão, preços, CAPTCHA, fila e exportação.

Referências: [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs), [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Vercel](https://vercel.com/docs).
