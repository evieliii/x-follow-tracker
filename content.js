// Copyright (C) 2026 evieliii
// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';

  if (window.top !== window || document.getElementById('xft-extension-root')) return;

  const Core = globalThis.XFollowCore;
  const STORAGE = {
    accounts: 'xftAccounts',
    current: 'xftCurrentHandle',
    session: 'xftScanSession',
    open: 'xftOpenOnLoad'
  };
  const RESERVED = new Set([
    'home', 'explore', 'notifications', 'messages', 'i', 'settings', 'compose',
    'search', 'lists', 'bookmarks', 'communities', 'jobs', 'premium', 'tos', 'privacy'
  ]);
  const VIEW_META = {
    notFollowingBack: ['未回关你', 'orange', '你正在关注、对方目前没有关注你的账号。'],
    youDoNotFollow: ['你未回关', 'blue', '正在关注你、但你目前没有关注的账号。'],
    mutual: ['双方互关', 'green', '你和对方目前互相关注。'],
    unfollowed: ['期间取关', 'red', '上一次快照中存在、最新快照中消失的粉丝。账号改名、注销或被封也可能出现在这里。'],
    newFollowers: ['新增粉丝', 'green', '最新快照相较上一次新增的粉丝。']
  };

  let panelOpen = false;
  let activeView = 'notFollowingBack';
  let searchQuery = '';
  let scannerRunning = false;
  let latestComparison = null;
  let currentHandle = '';
  let latestSnapshot = null;

  const host = document.createElement('div');
  host.id = 'xft-extension-root';
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .xft-shell { position: fixed; inset: 0; z-index: 2147483646; display: none; font: 14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; color: #171713; }
      .xft-shell.open { display: block; }
      .xft-scrim { position: absolute; inset: 0; background: rgba(10,12,16,.26); backdrop-filter: blur(2px); }
      .xft-panel { position: absolute; top: 12px; right: 12px; bottom: 12px; width: min(460px, calc(100vw - 24px)); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(17,20,25,.14); border-radius: 22px; background: #fffdf8; box-shadow: 0 24px 80px rgba(0,0,0,.24); }
      .xft-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 19px 14px; border-bottom: 1px solid #e8e3d8; }
      .xft-brand { display: flex; align-items: center; gap: 11px; }
      .xft-logo { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; background: #151513; color: #fff; font-size: 18px; font-weight: 850; }
      .xft-title { margin: 0; font-size: 17px; font-weight: 850; letter-spacing: -.02em; }
      .xft-subtitle { margin: 1px 0 0; color: #747168; font-size: 11px; }
      .xft-close { width: 34px; height: 34px; padding: 0; border: 1px solid #ddd8cc; border-radius: 10px; background: transparent; color: #333; font-size: 20px; cursor: pointer; }
      .xft-body { min-height: 0; flex: 1; overflow: auto; }
      .xft-setup { padding: 17px 19px; border-bottom: 1px solid #e8e3d8; background: #faf7f0; }
      .xft-label { display: block; margin-bottom: 6px; color: #656259; font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .08em; }
      .xft-input-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
      .xft-input { min-width: 0; height: 42px; padding: 0 12px; border: 1px solid #d8d2c5; border-radius: 11px; outline: none; background: #fff; color: #171713; font: inherit; }
      .xft-input:focus { border-color: #1769e0; box-shadow: 0 0 0 3px rgba(23,105,224,.12); }
      .xft-primary, .xft-secondary, .xft-tab, .xft-linkbtn { border: 0; font: inherit; cursor: pointer; }
      .xft-primary { padding: 0 16px; border-radius: 11px; background: #1769e0; color: #fff; font-weight: 800; }
      .xft-primary:hover { background: #0e5cca; }
      .xft-primary:disabled { opacity: .5; cursor: not-allowed; }
      .xft-help { margin: 8px 0 0; color: #7a776e; font-size: 11px; }
      .xft-progress { display: none; padding: 15px 19px; border-bottom: 1px solid #e8e3d8; background: #eef4ff; }
      .xft-progress.show { display: block; }
      .xft-progress-top { display: flex; justify-content: space-between; gap: 12px; font-weight: 750; }
      .xft-progress-msg { color: #174f9f; }
      .xft-cancel { padding: 0; background: transparent; color: #b22f39; font-weight: 750; }
      .xft-meter { height: 5px; margin-top: 10px; overflow: hidden; border-radius: 99px; background: #d8e5fa; }
      .xft-meter::after { content: ""; display: block; width: 34%; height: 100%; border-radius: inherit; background: #1769e0; animation: xft-slide 1.1s ease-in-out infinite alternate; }
      @keyframes xft-slide { from { transform: translateX(-20%); } to { transform: translateX(210%); } }
      .xft-empty { padding: 48px 30px; text-align: center; color: #77736a; }
      .xft-empty-icon { width: 54px; height: 54px; display: grid; place-items: center; margin: 0 auto 13px; border-radius: 17px; background: #f0ede5; color: #171713; font-size: 25px; }
      .xft-empty b { display: block; margin-bottom: 5px; color: #292824; font-size: 15px; }
      .xft-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; padding: 14px 19px; }
      .xft-stat { min-width: 0; padding: 11px; border-radius: 12px; background: #f3f0e8; }
      .xft-stat span { display: block; overflow: hidden; color: #77736a; font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }
      .xft-stat b { display: block; margin-top: 2px; font-size: 20px; letter-spacing: -.03em; }
      .xft-meta { display: flex; justify-content: space-between; gap: 10px; padding: 0 19px 12px; color: #77736a; font-size: 11px; }
      .xft-tabs { display: flex; gap: 6px; padding: 12px 19px; overflow-x: auto; border-top: 1px solid #e8e3d8; border-bottom: 1px solid #e8e3d8; scrollbar-width: none; }
      .xft-tab { flex: 0 0 auto; padding: 7px 10px; border: 1px solid #dcd6c9; border-radius: 999px; background: transparent; color: #69665e; font-size: 11px; font-weight: 750; }
      .xft-tab.active { border-color: #171713; background: #171713; color: #fff; }
      .xft-tools { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px 19px; }
      .xft-search { width: 100%; height: 36px; padding: 0 11px; border: 1px solid #ddd7ca; border-radius: 10px; outline: none; background: #fff; color: #171713; font: inherit; font-size: 12px; }
      .xft-secondary { padding: 0 12px; border: 1px solid #ccd9ef; border-radius: 10px; background: #eef4ff; color: #1769e0; font-size: 11px; font-weight: 800; }
      .xft-desc { margin: 0; padding: 0 19px 11px; color: #77736a; font-size: 10px; }
      .xft-list { border-top: 1px solid #eee9df; }
      .xft-person { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; padding: 12px 19px; border-bottom: 1px solid #eee9df; }
      .xft-person-main { min-width: 0; }
      .xft-name { overflow: hidden; font-weight: 780; white-space: nowrap; text-overflow: ellipsis; }
      .xft-handle { color: #747168; font-size: 12px; }
      .xft-open { padding: 6px 9px; border-radius: 9px; background: #eef4ff; color: #1769e0; text-decoration: none; font-size: 11px; font-weight: 800; }
      .xft-no-rows { padding: 34px 20px; color: #77736a; text-align: center; }
      .xft-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 19px; border-top: 1px solid #e8e3d8; background: #faf7f0; }
      .xft-privacy { color: #18794e; font-size: 10px; font-weight: 750; }
      .xft-linkbtn { padding: 0; background: transparent; color: #a52d35; font-size: 10px; }
      .xft-toast { position: absolute; right: 18px; bottom: 52px; max-width: 360px; padding: 10px 13px; border-radius: 10px; background: #171713; color: #fff; box-shadow: 0 10px 35px rgba(0,0,0,.24); font-size: 12px; opacity: 0; transform: translateY(8px); pointer-events: none; transition: .2s ease; }
      .xft-toast.show { opacity: 1; transform: translateY(0); }
      @media (max-width: 520px) { .xft-panel { inset: 0; width: 100%; border-radius: 0; } .xft-scrim { display: none; } }
    </style>
    <div class="xft-shell" id="shell">
      <div class="xft-scrim" data-action="close"></div>
      <aside class="xft-panel" role="dialog" aria-label="X 关注关系助手">
        <header class="xft-head">
          <div class="xft-brand"><div class="xft-logo">X↕</div><div><h2 class="xft-title">X 关注关系助手</h2><p class="xft-subtitle">本地扫描 · 不上传数据 · 不自动取关</p></div></div>
          <button class="xft-close" type="button" data-action="close" aria-label="关闭">×</button>
        </header>
        <div class="xft-body">
          <section class="xft-setup">
            <label class="xft-label" for="xft-handle">你的 X 用户名</label>
            <div class="xft-input-row">
              <input class="xft-input" id="xft-handle" autocomplete="off" spellcheck="false" placeholder="例如 @yourname">
              <button class="xft-primary" id="xft-start" type="button">一键扫描</button>
            </div>
            <p class="xft-help">扫描时会依次打开粉丝页和关注页并自动滚动。请保持此标签页打开。</p>
          </section>
          <section class="xft-progress" id="xft-progress">
            <div class="xft-progress-top"><span class="xft-progress-msg" id="xft-progress-msg">准备扫描…</span><button class="xft-cancel" id="xft-cancel" type="button">停止</button></div>
            <div class="xft-meter"></div>
          </section>
          <div id="xft-content"><div class="xft-empty"><div class="xft-empty-icon">↕</div><b>还没有扫描记录</b>填写用户名并点击“一键扫描”，建立第一份本地快照。</div></div>
        </div>
        <footer class="xft-footer"><span class="xft-privacy">● 数据仅保存在当前浏览器</span><button class="xft-linkbtn" type="button" id="xft-clear">清除本地数据</button></footer>
        <div class="xft-toast" id="xft-toast"></div>
      </aside>
    </div>`;

  const $ = selector => shadow.querySelector(selector);
  const storageGet = keys => chrome.storage.local.get(keys);
  const storageSet = values => chrome.storage.local.set(values);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function detectedHandle() {
    const accountButton = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    const accountMatch = accountButton && accountButton.innerText.match(/@([A-Za-z0-9_]{1,15})/);
    if (accountMatch) return accountMatch[1];
    const first = location.pathname.split('/').filter(Boolean)[0] || '';
    return RESERVED.has(first.toLowerCase()) ? '' : Core.normalizeHandle(first);
  }

  function openPanel(force) {
    panelOpen = typeof force === 'boolean' ? force : !panelOpen;
    $('#shell').classList.toggle('open', panelOpen);
    if (panelOpen) loadDashboard();
  }

  function toast(message) {
    const el = $('#xft-toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  async function loadDashboard() {
    const data = await storageGet([STORAGE.accounts, STORAGE.current, STORAGE.session]);
    const accounts = data[STORAGE.accounts] || {};
    const session = data[STORAGE.session];
    currentHandle = Core.normalizeHandle(data[STORAGE.current]) || detectedHandle();
    if (!currentHandle) currentHandle = Object.keys(accounts)[0] || '';
    $('#xft-handle').value = currentHandle ? `@${currentHandle}` : '';
    updateProgress(session);

    const entry = currentHandle && accounts[currentHandle.toLowerCase()];
    if (!entry || !entry.snapshots || !entry.snapshots.length) {
      latestSnapshot = null;
      latestComparison = null;
      $('#xft-content').innerHTML = '<div class="xft-empty"><div class="xft-empty-icon">↕</div><b>还没有扫描记录</b>填写用户名并点击“一键扫描”，建立第一份本地快照。</div>';
      return;
    }

    const snapshots = entry.snapshots;
    latestSnapshot = snapshots[snapshots.length - 1];
    const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
    latestComparison = Core.compareSnapshots(latestSnapshot, previous);
    renderDashboard(snapshots.length, latestSnapshot, previous);
  }

  function updateProgress(session) {
    const active = !!(session && session.active);
    $('#xft-progress').classList.toggle('show', active);
    $('#xft-start').disabled = active;
    if (!active) return;
    const stage = session.stage === 'followers' ? '粉丝' : '关注';
    const count = (session.temp && session.temp[session.stage] || []).length;
    $('#xft-progress-msg').textContent = `正在扫描${stage}：已发现 ${count.toLocaleString('zh-CN')} 个账号`;
  }

  function renderDashboard(snapshotCount, snapshot, previous) {
    const c = latestComparison;
    const tabs = Object.entries(VIEW_META).map(([key, meta]) => {
      const count = c[key].length;
      return `<button class="xft-tab ${key === activeView ? 'active' : ''}" type="button" data-view="${key}">${meta[0]} ${count}</button>`;
    }).join('');
    const when = new Date(snapshot.at).toLocaleString('zh-CN', { hour12: false });
    $('#xft-content').innerHTML = `
      <div class="xft-stats">
        <div class="xft-stat"><span>当前粉丝</span><b>${c.followers.toLocaleString('zh-CN')}</b></div>
        <div class="xft-stat"><span>当前关注</span><b>${c.following.toLocaleString('zh-CN')}</b></div>
        <div class="xft-stat"><span>未回关你</span><b>${c.notFollowingBack.length.toLocaleString('zh-CN')}</b></div>
      </div>
      <div class="xft-meta"><span>${snapshotCount} 份本地快照</span><span>更新于 ${escapeHtml(when)}</span></div>
      <div class="xft-tabs">${tabs}</div>
      <div class="xft-tools"><input class="xft-search" id="xft-search" type="search" placeholder="搜索用户名或名称" value="${escapeHtml(searchQuery)}"><button class="xft-secondary" id="xft-export" type="button">导出 CSV</button></div>
      <p class="xft-desc">${escapeHtml(VIEW_META[activeView][2])}${previous ? '' : ' 需要至少两次扫描才能识别期间变化。'}</p>
      <div class="xft-list" id="xft-list"></div>`;
    renderRows();
    $('#xft-search').addEventListener('input', event => { searchQuery = event.target.value; renderRows(); });
    $('#xft-export').addEventListener('click', exportCurrentView);
  }

  function renderRows() {
    const list = $('#xft-list');
    if (!list || !latestComparison) return;
    const query = searchQuery.trim().toLowerCase();
    const rows = latestComparison[activeView].filter(row => !query || row.handle.toLowerCase().includes(query) || row.name.toLowerCase().includes(query));
    list.innerHTML = rows.length ? rows.map(row => `
      <div class="xft-person">
        <div class="xft-person-main"><div class="xft-name">${escapeHtml(row.name)}</div><div class="xft-handle">@${escapeHtml(row.handle)}</div></div>
        <a class="xft-open" href="https://x.com/${encodeURIComponent(row.handle)}" target="_blank" rel="noopener noreferrer">查看 ↗</a>
      </div>`).join('') : '<div class="xft-no-rows">没有匹配的账号</div>';
  }

  function exportCurrentView() {
    if (!latestComparison) return;
    const rows = latestComparison[activeView];
    if (!rows.length) return toast('当前分类没有可导出的账号');
    const csv = Core.csvFor(rows, VIEW_META[activeView][0]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `X-${currentHandle}-${VIEW_META[activeView][0]}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function currentStagePath(handle, stage) {
    return `/${handle}/${stage === 'followers' ? 'followers' : 'following'}`;
  }

  async function startScan() {
    const handle = Core.normalizeHandle($('#xft-handle').value);
    if (!handle) return toast('请输入有效的 X 用户名');
    const session = {
      active: true,
      handle,
      stage: 'followers',
      startedAt: new Date().toISOString(),
      temp: { followers: [], following: [] }
    };
    currentHandle = handle;
    await storageSet({ [STORAGE.current]: handle, [STORAGE.session]: session });
    updateProgress(session);
    const target = currentStagePath(handle, 'followers');
    if (location.pathname.replace(/\/$/, '').toLowerCase() === target.toLowerCase()) runScanStage(session);
    else location.assign(`https://x.com${target}`);
  }

  async function cancelScan() {
    const data = await storageGet(STORAGE.session);
    const session = data[STORAGE.session] || {};
    session.active = false;
    await storageSet({ [STORAGE.session]: session });
    scannerRunning = false;
    updateProgress(session);
    toast('扫描已停止');
  }

  function profileFromCell(cell) {
    if (!cell || !cell.matches('[data-testid="UserCell"]')) return null;
    const links = [...cell.querySelectorAll('a[href]')];
    let handle = '';
    for (const link of links) {
      const path = (link.getAttribute('href') || '').split('?')[0];
      const match = path.match(/^\/([A-Za-z0-9_]{1,15})$/);
      if (match && !RESERVED.has(match[1].toLowerCase())) { handle = match[1]; break; }
    }
    if (!handle) return null;
    const lines = (cell.innerText || '').split('\n').map(x => x.trim()).filter(Boolean);
    const handleIndex = lines.findIndex(line => line.toLowerCase() === `@${handle.toLowerCase()}`);
    let name = handleIndex > 0 ? lines[handleIndex - 1] : lines[0];
    if (!name || name.startsWith('@')) name = handle;
    return { handle, name };
  }

  function extractVisibleProfiles(root) {
    const scope = root || document.querySelector('[data-testid="primaryColumn"]');
    if (!scope) return [];
    const cells = scope.matches && scope.matches('[data-testid="UserCell"]')
      ? [scope]
      : scope.querySelectorAll('[data-testid="UserCell"]');
    const profiles = [];
    for (const cell of cells) {
      const profile = profileFromCell(cell);
      if (profile) profiles.push(profile);
    }
    return profiles;
  }

  function pageHasRateError() {
    const text = (document.querySelector('[data-testid="primaryColumn"]') || document.body).innerText || '';
    return /rate limit exceeded|something went wrong|try again later|超过频率|出错了|请稍后重试/i.test(text);
  }

  async function waitForListPage() {
    for (let i = 0; i < 30; i++) {
      if (document.querySelector('[data-testid="primaryColumn"]')) return;
      await delay(500);
    }
    throw new Error('未找到 X 列表页面，请确认已经登录 X');
  }

  async function runScanStage(initialSession) {
    if (scannerRunning) return;
    scannerRunning = true;
    let observer = null;
    panelOpen = true;
    $('#shell').classList.add('open');
    try {
      await waitForListPage();
      let session = initialSession;
      const primary = document.querySelector('[data-testid="primaryColumn"]');
      const collected = Core.mapProfiles(session.temp && session.temp[session.stage]);
      let stableAtBottom = 0;
      let cycles = 0;
      const stageStartedAt = Date.now();
      let lastGrowthAt = Date.now();

      const absorb = root => {
        const before = collected.size;
        for (const profile of extractVisibleProfiles(root)) collected.set(profile.handle.toLowerCase(), profile);
        if (collected.size > before) lastGrowthAt = Date.now();
        return collected.size - before;
      };
      observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches('[data-testid="UserCell"]')) absorb(node);
            else absorb(node);
          }
        }
      });
      observer.observe(primary, { childList: true, subtree: true });

      if (!collected.size) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        await delay(700);
      }

      while (session.active && stableAtBottom < 12 && cycles < 6000 && collected.size < 100000) {
        if (pageHasRateError()) throw new Error('X 暂时限制了页面加载，请稍后再扫描');
        const added = absorb(primary);
        const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const atBottom = window.scrollY + window.innerHeight >= pageHeight - 220;
        const loading = !!primary.querySelector('[role="progressbar"]');
        const quietFor = Date.now() - lastGrowthAt;

        if (added > 0 || !atBottom) stableAtBottom = 0;
        else if (loading || quietFor < 2500) stableAtBottom = Math.max(0, stableAtBottom - 1);
        else stableAtBottom++;
        cycles++;

        session.temp[session.stage] = [...collected.values()];
        if (cycles % 12 === 0) {
          const fresh = await storageGet(STORAGE.session);
          if (!fresh[STORAGE.session] || !fresh[STORAGE.session].active) break;
          session = { ...fresh[STORAGE.session], temp: session.temp };
          await storageSet({ [STORAGE.session]: session });
        }
        updateProgress(session);
        if (atBottom) window.scrollTo({ top: pageHeight, behavior: 'auto' });
        else window.scrollBy({ top: Math.max(420, Math.floor(window.innerHeight * 0.72)), behavior: 'auto' });
        await delay(atBottom ? 1200 : 480);
      }
      observer.disconnect();
      observer = null;

      const fresh = await storageGet(STORAGE.session);
      session = fresh[STORAGE.session] || session;
      if (!session.active) return;
      session.temp[session.stage] = [...collected.values()];
      session.diagnostics = session.diagnostics || {};
      session.diagnostics[session.stage] = {
        accounts: collected.size,
        cycles,
        durationMs: Date.now() - stageStartedAt,
        completedAtBottom: stableAtBottom >= 12,
        hitSafetyLimit: cycles >= 6000 || collected.size >= 100000
      };

      if (cycles >= 6000 || collected.size >= 100000) {
        throw new Error('扫描达到安全上限，结果未保存；请稍后重试或联系维护者');
      }

      if (session.stage === 'followers') {
        session.stage = 'following';
        await storageSet({ [STORAGE.session]: session });
        location.assign(`https://x.com${currentStagePath(session.handle, 'following')}`);
        return;
      }

      await finishScan(session);
    } catch (error) {
      const data = await storageGet(STORAGE.session);
      const session = data[STORAGE.session] || {};
      session.active = false;
      session.error = error.message;
      await storageSet({ [STORAGE.session]: session });
      updateProgress(session);
      toast(error.message);
    } finally {
      if (observer) observer.disconnect();
      scannerRunning = false;
    }
  }

  async function finishScan(session) {
    const data = await storageGet(STORAGE.accounts);
    const accounts = data[STORAGE.accounts] || {};
    const key = session.handle.toLowerCase();
    const entry = accounts[key] || { handle: session.handle, snapshots: [] };
    const snapshot = {
      id: Date.now(),
      at: new Date().toISOString(),
      followers: session.temp.followers || [],
      following: session.temp.following || [],
      diagnostics: session.diagnostics || {}
    };
    entry.handle = session.handle;
    entry.snapshots.push(snapshot);
    accounts[key] = entry;
    session.active = false;
    session.completedAt = snapshot.at;
    await storageSet({ [STORAGE.accounts]: accounts, [STORAGE.current]: session.handle, [STORAGE.session]: session });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadDashboard();
    toast(`扫描完成：${snapshot.followers.length} 位粉丝，${snapshot.following.length} 个关注`);
  }

  async function resumeScanIfNeeded() {
    const data = await storageGet([STORAGE.session, STORAGE.open]);
    if (data[STORAGE.open]) {
      await chrome.storage.local.remove(STORAGE.open);
      openPanel(true);
    }
    const session = data[STORAGE.session];
    if (!session || !session.active) return;
    panelOpen = true;
    $('#shell').classList.add('open');
    updateProgress(session);
    const expected = currentStagePath(session.handle, session.stage).toLowerCase();
    if (location.pathname.replace(/\/$/, '').toLowerCase() !== expected) location.assign(`https://x.com${expected}`);
    else runScanStage(session);
  }

  async function clearLocalData() {
    if (!confirm('确定清除所有本地快照和扫描记录吗？此操作无法撤销。')) return;
    await chrome.storage.local.remove(Object.values(STORAGE));
    activeView = 'notFollowingBack'; searchQuery = ''; currentHandle = detectedHandle();
    await loadDashboard();
    toast('本地数据已清除');
  }

  shadow.addEventListener('click', event => {
    const close = event.target.closest('[data-action="close"]');
    if (close) return openPanel(false);
    const tab = event.target.closest('[data-view]');
    if (tab && latestComparison) {
      activeView = tab.dataset.view;
      searchQuery = '';
      loadDashboard();
    }
  });
  $('#xft-start').addEventListener('click', startScan);
  $('#xft-cancel').addEventListener('click', cancelScan);
  $('#xft-clear').addEventListener('click', clearLocalData);
  $('#xft-handle').addEventListener('keydown', event => { if (event.key === 'Enter') startScan(); });
  chrome.runtime.onMessage.addListener(message => { if (message && message.type === 'XFT_TOGGLE_PANEL') openPanel(); });

  loadDashboard();
  resumeScanIfNeeded();
})();
