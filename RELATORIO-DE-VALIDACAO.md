# Relatório de validação — Cata Preço+ 1.1.0 híbrido

Data: 21/08/2026

## Status

**Candidato de prévia. Produção bloqueada até validar a extensão carregada em um Chrome com suporte a extensões.**

## Aprovado

- 33/33 testes automatizados.
- Sintaxe aprovada para painel, APIs, content script, service worker e build.
- ZIP íntegro com `manifest.json`, `content.js`, `service-worker.js` e `popup.html` na raiz.
- O painel não chama mais `/api/scrape`; “Iniciar” permanece bloqueado sem o coletor.
- Comunicação aceita somente o painel Cata Preço+ e seus previews.
- A extensão abre a aba do fornecedor com `active: true` e nunca usa `chrome.tabs.remove()`.
- Pausa, retomada, cancelamento, recuperação do storage e repetição da mesma página após CAPTCHA/login cobertos por regressão.
- URL sem protocolo recebe `https://`.
- Redirecionamento legítimo para `www` atualiza a origem antes da descoberta.
- MS Atacado ao vivo: 65 cards reconhecidos na primeira página; amostra validada com nomes, preços e imagens reais.
- Luiz Eletrônicos ao vivo e deslogado: 48 links de produtos, zero preços de produto e link de login; decisão validada como `PAUSAR_PARA_LOGIN`.
- Valores do rodapé do Luiz Eletrônicos (pedido mínimo de R$ 500, R$ 1.000 e R$ 1.500) não são aceitos como preço de produto.

## Pendente antes da produção

- Carregar o ZIP numa instância de Chrome que permita extensões Manifest V3.
- Confirmar no painel publicado o estado “Coletor conectado”.
- Executar MS Atacado pelo fluxo completo painel → extensão → aba → painel.
- Entrar no Luiz Eletrônicos com uma conta autorizada, clicar em Continuar e confirmar que os preços liberados são coletados.
- Testar Pausar, Continuar, Cancelar e exportações no fluxo integrado.

Nenhuma versão deve ser descrita como totalmente aprovada enquanto esses itens estiverem pendentes.
