(function(){
  'use strict';
  if (window.__PANEL_MOBILE_APK_HANDOFF_V3__) return;
  window.__PANEL_MOBILE_APK_HANDOFF_V3__ = true;

  const VERSION = '2026.09.08-apk-handoff-v5';
  const STORAGE_KEY = 'painelRevendaApkHandoff:v3';
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  if (!isAndroid) {
    console.info('[Painel Revenda] fluxo APK ignorado fora do Android:', VERSION);
    return;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const safe = v => String(v == null ? '' : v);
  const esc = v => safe(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let baseOpenModal = null;
  let pollToken = 0;

  function getProductById(id){
    try { return Array.isArray(catalog) ? catalog.find(x => String(x.id) === String(id)) : null; }
    catch (_) { return null; }
  }
  function productKey(p){
    try { return catalogRowKey(p); }
    catch (_) { return p && (p.link || p.id || p.name) || ''; }
  }
  function readState(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function writeState(v){
    try { if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); else localStorage.removeItem(STORAGE_KEY); }
    catch (_) {}
  }
  function activeView(){
    return document.querySelector('.side-nav [data-view].active')?.dataset?.view || 'catalogos';
  }

  function ensureStyles(){
    if (document.getElementById('apkHandoffStyles')) return;
    const st = document.createElement('style');
    st.id = 'apkHandoffStyles';
    st.textContent = `
      .apk-handoff-overlay{position:fixed;inset:0;z-index:100000;background:rgba(4,8,17,.88);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px}
      .apk-handoff-card{width:min(520px,100%);background:linear-gradient(180deg,#172235,#0d1524);border:1px solid #33455f;border-radius:22px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45);color:#f8fbff;text-align:center}
      .apk-handoff-icon{font-size:46px;line-height:1;margin-bottom:12px}.apk-handoff-card h3{margin:0 0 8px;font-size:21px}.apk-handoff-product{color:#d8e5f5;font-weight:700;margin:0 0 15px;line-height:1.4}
      .apk-handoff-sub{font-size:13px;color:#9fb0c6;line-height:1.5;margin:10px 0 0}.apk-handoff-spinner{width:34px;height:34px;border-radius:50%;border:3px solid #33465e;border-top-color:#60a5fa;animation:apkspin .8s linear infinite;margin:14px auto}
      .apk-handoff-progress{height:8px;border-radius:999px;background:#243249;overflow:hidden;margin:15px 0}.apk-handoff-progress i{display:block;height:100%;width:34%;border-radius:inherit;background:linear-gradient(90deg,#3b82f6,#22c55e);animation:apkbar 1.4s ease-in-out infinite alternate}
      .apk-handoff-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-top:17px}.apk-handoff-btn{border:0;border-radius:12px;padding:12px 15px;font-weight:800;cursor:pointer;background:#2563eb;color:#fff}.apk-handoff-btn.secondary{background:#263449;color:#dbe8f6;border:1px solid #3a4a61}
      .apk-handoff-error{color:#fca5a5;background:rgba(127,29,29,.22);border:1px solid rgba(248,113,113,.3);padding:10px;border-radius:12px;margin-top:13px;font-size:13px}
      @keyframes apkspin{to{transform:rotate(360deg)}} @keyframes apkbar{from{transform:translateX(-35%)}to{transform:translateX(195%)}}
    `;
    document.head.appendChild(st);
  }

  function overlayEl(){ return document.getElementById('apkHandoffOverlay'); }
  function hideOverlay(){ overlayEl()?.remove(); }
  function showOverlay(p, opts={}){
    ensureStyles();
    let el = overlayEl();
    if (!el) {
      el = document.createElement('div');
      el.id = 'apkHandoffOverlay';
      el.className = 'apk-handoff-overlay';
      document.body.appendChild(el);
    }
    const error = opts.error ? `<div class="apk-handoff-error">${esc(opts.error)}</div>` : '';
    const status = opts.status || 'Aguardando dados do Coletor APK';
    const sub = opts.sub || 'O Coletor vai pesquisar e ler 3 páginas da Shopee. Mantenha o APK aberto até a barra de progresso terminar.';
    el.innerHTML = `<div class="apk-handoff-card">
      <div class="apk-handoff-icon">📱</div>
      <h3>${esc(status)}</h3>
      <p class="apk-handoff-product">${esc(p?.name || 'Produto')}</p>
      ${opts.done ? '<div style="font-size:42px;margin:10px 0">✅</div>' : '<div class="apk-handoff-spinner"></div><div class="apk-handoff-progress"><i></i></div>'}
      <p class="apk-handoff-sub">${esc(sub)}</p>
      ${error}
      <div class="apk-handoff-actions">
        ${opts.reopen !== false ? '<button type="button" class="apk-handoff-btn" id="apkHandoffReopen">Abrir app</button>' : ''}
        <button type="button" class="apk-handoff-btn secondary" id="apkHandoffClose">Fechar aviso</button>
      </div>
    </div>`;
    document.getElementById('apkHandoffClose')?.addEventListener('click', hideOverlay);
    document.getElementById('apkHandoffReopen')?.addEventListener('click', () => {
      const st = readState();
      if (st) openApk(st);
    });
    const badge = document.getElementById('marketCollectorBadge');
    if (badge) {
      badge.className = 'collector-badge warn';
      badge.textContent = '📱 Aguardando dados do Coletor APK';
    }
    return el;
  }

  function returnUrlFor(state){
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.set('market_return', state.catalogLink);
    url.searchParams.set('market_product', state.productId);
    url.searchParams.set('market_started', state.startedAt);
    url.searchParams.set('market_view', state.returnView || 'catalogos');
    return url.toString();
  }

  function deepLinkFor(state){
    const params = new URLSearchParams();
    params.set('catalog_link', state.catalogLink);
    params.set('product_name', state.productName);
    params.set('return_url', returnUrlFor(state));
    if (state.categoryId) params.set('category_id', state.categoryId);
    if (state.categoryName) params.set('category_name', state.categoryName);
    if (state.categoryPath) params.set('category_path', state.categoryPath);
    return 'coletorshopee://collect?' + params.toString();
  }

  function enqueueInBackground(p){
    const payload = {
      p_catalog_link: productKey(p),
      p_product_name: p.name,
      p_category_id: p.shopeeCategoryId || null,
      p_category_name: p.shopeeCategoryName || null,
      p_category_path: p.shopeeCategoryPath || null
    };
    try {
      if (typeof SB_URL !== 'undefined' && typeof SB_KEY !== 'undefined' && authSession?.access_token) {
        return fetch(`${SB_URL}/rest/v1/rpc/revenda_market_enqueue_priority_job`, {
          method:'POST', keepalive:true,
          headers:{
            apikey:SB_KEY,
            Authorization:`Bearer ${authSession.access_token}`,
            'Content-Type':'application/json'
          },
          body:JSON.stringify(payload)
        }).then(async r => {
          if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
          return true;
        });
      }
      if (typeof sbFetch === 'function') {
        return sbFetch('rpc/revenda_market_enqueue_priority_job',{method:'POST',body:JSON.stringify(payload)}).then(()=>true);
      }
    } catch (e) { return Promise.reject(e); }
    return Promise.reject(new Error('Sessão do Painel indisponível.'));
  }

  function openApk(state){
    const uri = deepLinkFor(state);
    const intentUri = `intent://collect?${uri.split('?')[1] || ''}#Intent;scheme=coletorshopee;package=com.greskgja.coletorshopeemobile;end`;
    showOverlay({name:state.productName},{status:'Aguardando conexão com o app',sub:'Toque em “Abrir app”. O Coletor Shopee vai receber este produto, iniciar a pesquisa e ler 3 páginas.',reopen:true});
    try { window.location.href = uri; }
    catch (e) {
      try { window.location.href = intentUri; }
      catch (_) { showOverlay({name:state.productName},{error:'Não consegui abrir o Coletor Shopee. Verifique se a versão 0.3.0 está instalada.',reopen:true}); }
    }
    setTimeout(()=>{
      if (!document.hidden && readState()?.catalogLink === state.catalogLink) {
        try { window.location.href = intentUri; } catch (_) {}
      }
    },900);
    setTimeout(()=>{
      if (!document.hidden && readState()?.catalogLink === state.catalogLink) {
        showOverlay({name:state.productName},{status:'Aguardando conexão com o app',sub:'Se o aplicativo não abriu, toque novamente em “Abrir app”. É necessário ter o Coletor Shopee 0.3.0 instalado.',reopen:true});
      }
    },1800);
  }

  async function getLatestCollection(state){
    if (typeof sbFetch !== 'function') return null;
    const rows = await sbFetch(`revenda_market_collections?catalog_link=eq.${encodeURIComponent(state.catalogLink)}&select=*&order=collected_at.desc&limit=1`,{method:'GET'});
    const c = Array.isArray(rows) ? rows[0] : null;
    if (!c) return null;
    const started = Date.parse(state.startedAt || 0) || 0;
    const collected = Date.parse(c.collected_at || c.updated_at || 0) || 0;
    return collected >= started - 3000 ? c : null;
  }

  async function getLatestJob(state){
    if (typeof sbFetch !== 'function') return null;
    const rows = await sbFetch(`revenda_market_jobs?catalog_link=eq.${encodeURIComponent(state.catalogLink)}&select=status,last_error,updated_at,completed_at&order=updated_at.desc&limit=1`,{method:'GET'});
    return Array.isArray(rows) ? rows[0] : null;
  }

  async function finishReturn(state, collection){
    pollToken++;
    writeState(null);
    hideOverlay();
    try {
      if (typeof switchView === 'function') switchView(state.returnView || 'catalogos');
    } catch (_) {}
    const url = new URL(location.href);
    ['market_return','market_product','market_started','market_view'].forEach(k=>url.searchParams.delete(k));
    try { history.replaceState({},'',url.pathname + (url.search ? url.search : '') + url.hash); } catch (_) {}
    const p = getProductById(state.productId) || (Array.isArray(catalog) ? catalog.find(x => productKey(x) === state.catalogLink) : null);
    if (!p) return;
    const items = Array.isArray(collection?.items) ? collection.items : [];
    const confirmedZero = items.length === 0 && (
      collection?.meta?.confirmed_zero_results === true ||
      Number(collection?.total_items || 0) === 0
    );
    if (confirmedZero) {
      showOverlay(p,{
        done:true,
        status:'Pesquisa concluída',
        sub:'O Coletor terminou a leitura das 3 páginas da Shopee e não encontrou anúncios para este produto.',
        reopen:false
      });
      return;
    }
    try {
      await baseOpenModal(p.id);
      setTimeout(()=>{
        const badge = document.getElementById('marketCollectorBadge');
        if (badge) {
          badge.className = 'collector-badge ok';
          badge.textContent = '📱 Dados recebidos do Coletor APK';
        }
        const notice = document.getElementById('marketSourceNotice');
        if (notice && collection?.collected_at) {
          const when = new Date(collection.collected_at).toLocaleString('pt-BR');
          notice.insertAdjacentHTML('afterbegin', `<span style="display:block;margin-bottom:6px">📱 <b>Coleta concluída pelo APK</b> · ${esc(when)}</span>`);
        }
      }, 450);
    }
    catch (e) { console.warn('[apk handoff] abrir resultados', e); }
  }

  async function pollForReturn(state){
    const token = ++pollToken;
    let cycles = 0;
    while (token === pollToken && cycles < 400) {
      cycles++;
      const p = getProductById(state.productId) || (Array.isArray(catalog) ? catalog.find(x => productKey(x) === state.catalogLink) : null);
      if (p) showOverlay(p,{status:'Aguardando conexão com o app',sub:'A coleta está sendo finalizada. Assim que os dados chegarem, a Análise de mercado abre automaticamente.',reopen:true});
      try {
        const collection = await getLatestCollection(state);
        if (collection) return finishReturn(state, collection);
        const job = await getLatestJob(state);
        if (job?.status === 'error') {
          showOverlay(p || {name:state.productName},{status:'O Coletor não concluiu a pesquisa',error:job.last_error || 'A pesquisa terminou com erro.',sub:'Abra o Coletor novamente para repetir a busca.',reopen:true});
          return;
        }
      } catch (e) { console.warn('[apk handoff] aguardando retorno',e); }
      await sleep(1500);
    }
  }

  async function launchMarketOnApk(productId){
    const p = getProductById(productId);
    if (!p) return baseOpenModal(productId);
    const state = {
      productId:String(p.id),
      catalogLink:String(productKey(p)),
      productName:safe(p.name),
      categoryId:p.shopeeCategoryId || '',
      categoryName:p.shopeeCategoryName || '',
      categoryPath:p.shopeeCategoryPath || '',
      returnView:activeView(),
      startedAt:new Date().toISOString()
    };
    writeState(state);
    showOverlay(p,{status:'Aguardando conexão com o app',sub:'A pesquisa foi preparada. Toque em “Abrir app” para iniciar o Coletor Shopee. Quando terminar, use “Voltar para análise de mercado” no app.',reopen:true});
    enqueueInBackground(p).catch(err=>console.warn('[apk handoff] fila',err));
    pollForReturn(state);
  }

  function installOpenModalHook(){
    if (typeof openModal !== 'function') return false;
    if (openModal.__apkHandoffWrapped) return true;
    baseOpenModal = openModal;
    const wrapped = function(productId){ return launchMarketOnApk(productId); };
    wrapped.__apkHandoffWrapped = true;
    openModal = wrapped;
    return true;
  }

  async function restoreReturn(){
    const params = new URL(location.href).searchParams;
    const fromUrl = params.get('market_return');
    let state = readState();
    if (!state && fromUrl) {
      state = {
        catalogLink:fromUrl,
        productId:params.get('market_product') || '',
        productName:'Produto',
        startedAt:params.get('market_started') || new Date(Date.now()-10*60*1000).toISOString(),
        returnView:params.get('market_view') || 'catalogos'
      };
      writeState(state);
    }
    if (!state) return;
    for (let i=0;i<60;i++) {
      const authReady = typeof authSession !== 'undefined' && authSession?.access_token;
      const catalogReady = typeof catalog !== 'undefined' && Array.isArray(catalog);
      if (authReady && catalogReady) break;
      await sleep(500);
    }
    pollForReturn(state);
  }

  const hookTimer = setInterval(()=>{
    if (installOpenModalHook()) clearInterval(hookTimer);
  },100);
  setTimeout(()=>{ installOpenModalHook(); restoreReturn(); },250);
  window.addEventListener('pageshow',()=>{ installOpenModalHook(); restoreReturn(); });
  window.addEventListener('focus',()=>{
    const st=readState();
    if(st && !document.hidden) pollForReturn(st);
  });
  document.addEventListener('visibilitychange',()=>{
    const st=readState();
    if(st && !document.hidden) pollForReturn(st);
  });

  console.info('[Painel Revenda] fluxo Android -> APK ativo:', VERSION);
})();
