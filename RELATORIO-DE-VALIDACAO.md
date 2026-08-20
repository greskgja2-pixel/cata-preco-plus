# Relatório de validação — Cata Preço+ 1.0.0

Data: 20/08/2026

## Resultado atual

**Status: candidato de teste; publicação em produção bloqueada.**

O código, o servidor local, os módulos, a exportação e a auditoria de dependências foram validados. A execução visual completa e uma pesquisa ao vivo numa Preview Deployment da Vercel não puderam ser executadas neste ambiente. Portanto, este pacote não deve ser descrito como “100% funcionando” até concluir os testes pendentes.

## Aprovado

- 15/15 testes automatizados.
- Todos os arquivos JavaScript passam em `node --check`.
- Servidor Express inicia e entrega `public/index.html`.
- Endpoint de exportação gera um arquivo Microsoft Excel 2007+ válido.
- XLSX reaberto com acentuação e exatamente sete colunas.
- Parser de preço brasileiro, embalagem, JSON-LD e imagem testado.
- Página de categoria sem preço não é salva como produto.
- Produto sem preço não é contado como extraído com sucesso.
- CAPTCHA/bloqueio produz estado `blocked`, não `completed`.
- URL privada/local, protocolo inseguro e navegação SSRF são bloqueados.
- Cancelamento com `AbortController` preserva os produtos já transmitidos no frontend.
- Playwright 1.53.2 alinhado ao Chromium 138.0.2.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas.

## Erros encontrados durante a própria validação e corrigidos

1. O curinga `app.get('*')` quebrava a inicialização no Express 5. Substituído por middleware de fallback e coberto por teste.
2. Dependências com `^` instalaram Playwright 1.62.1, incompatível com o Chromium 138. As versões foram fixadas.
3. O pacote `xlsx` apresentava vulnerabilidade alta sem correção no npm. Foi substituído por ExcelJS e a auditoria voltou a zero.
4. ExcelJS trazia uma versão vulnerável de `uuid`. Foi aplicada uma versão segura por `overrides`, com exportação revalidada.
5. O parser interpretava `R$ 1.234` como 1,234. A regra brasileira de milhar foi adicionada e testada.
6. As rotas de navegação não validavam cada redirecionamento contra SSRF. Toda navegação agora passa pela validação de URL pública.

## Bloqueios pendentes antes de produção

- O Chromium serverless não inicia neste contêiner porque o sistema de arquivos rejeita `chown` durante a extração dos binários. Isso é uma limitação do ambiente atual; precisa ser testado numa Preview Deployment real da Vercel.
- O download do navegador de teste do Playwright retornou um arquivo vazio/truncado neste ambiente. Assim, cliques e console ainda não foram aprovados num navegador local real.
- Nenhum fornecedor real foi informado/autorizado neste novo projeto. O scraping precisa ser testado separadamente em cada site pretendido.
- CAPTCHA real, infinite scroll específico, paginação e seletores variam por fornecedor e exigem evidência ao vivo.

## Roteiro obrigatório para liberar publicação

1. Criar Preview Deployment na Vercel.
2. Abrir a página em Chrome, verificar console sem erros e testar responsividade.
3. Validar campos obrigatórios e URL inválida.
4. Executar um site de homologação público com JSON-LD e outro com fallbacks CSS.
5. Confirmar progresso incremental, contagem, cancelamento e preservação parcial.
6. Executar página controlada com CAPTCHA e confirmar estado `blocked`.
7. Abrir os arquivos JSON e XLSX e conferir as sete colunas e os valores.
8. Testar cada fornecedor real autorizado e registrar páginas, produtos esperados e diferenças.
9. Somente após todos os itens passarem, promover a Preview Deployment para produção.
