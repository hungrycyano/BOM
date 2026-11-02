/* B.O.M.　ボム — app.js
 * ハッシュルーティング・一覧／記事描画・検索パネル・固定ボタン・コメント・アクセス解析
 *
 * ルート：
 *   #/                  トップ（最新記事＋一覧）
 *   #/post/<slug>       記事
 *   #/tag/<tag>         タグ別
 *   #/category/<name>   カテゴリー別
 *   #/month/<YYYY-MM>   月別
 *   #/search?q=...      キーワード検索
 *   #/tags #/categories #/archive  一覧ページ
 *   #/about             このブログについて
 */
(function () {
  'use strict';

  const S = window.BOMSearch;
  const esc = S.escapeHtml;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const DEFAULT_CONFIG = {
    title: 'B.O.M.　ボム',
    subtitles: [],
    description: '',
    icon: 'assets/img/icon.svg',
    eyecatch: 'assets/img/eyecatch.svg',
    eyecatchAlt: '',
    pageSize: 20,
    comments: { repo: '', repoId: '', category: '', categoryId: '' },
    analytics: { goatcounter: '' },
  };
  const TYPE_LABEL = { md: '記事', slides: 'スライド', story: '紙芝居' };
  const LIST_ROUTES = ['home', 'tag', 'category', 'month', 'search'];
  const STORE_KEY = 'bom:lastList';

  const state = {
    config: DEFAULT_CONFIG,
    allPosts: [], // posts.json の全記事（予約記事を含む）
    posts: [],    // いま公開中の記事だけ（一覧・検索・最新記事はこちらを使う）
    preview: false,
    bodies: null,
    route: null,
    shown: 0,
    lastList: loadStore(STORE_KEY),
    cleanups: [],
    renderId: 0,
  };

  const main = $('#main');

  // ---------------------------------------------------------------- utils
  function loadStore(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function saveStore(key, val) {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 無視 */ }
  }
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ': ' + r.status);
    return r.json();
  }
  async function fetchText(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ': ' + r.status);
    return r.text();
  }
  function enc(s) { return encodeURIComponent(s); }
  function scrollToY(y, smooth) {
    const html = document.documentElement;
    if (!smooth) html.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    if (!smooth) requestAnimationFrame(() => { html.style.scrollBehavior = ''; });
  }
  function formatDate(p) {
    const m = String(p.date).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return String(p.date);
    let s = `${+m[1]}年${+m[2]}月${+m[3]}日`;
    if (p.hasTime && !(m[4] === '00' && m[5] === '00')) s += ` ${m[4]}:${m[5]}`;
    return s;
  }
  function monthLabel(ym) {
    const [y, m] = ym.split('-');
    return `${+y}年${+m}月`;
  }

  // 簡易フロントマター（scripts/build-index.mjs と同じ規則）
  function parseFrontMatter(text) {
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const m = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (!m) return { data: {}, body: text };
    const scalar = (v) => {
      v = v.trim();
      if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) return v.slice(1, -1);
      if (v[0] === '[' && v.endsWith(']')) return v.slice(1, -1).split(',').map(scalar).filter((x) => x !== '');
      if (/^(true|yes|on)$/i.test(v)) return true;
      if (/^(false|no|off)$/i.test(v)) return false;
      return v;
    };
    const data = {};
    let listKey = null;
    for (const raw of m[1].split('\n')) {
      const line = raw.replace(/\s+#.*$/, '');
      if (!line.trim()) continue;
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item && listKey) { data[listKey].push(scalar(item[1])); continue; }
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!kv) continue;
      if (kv[2].trim() === '') { data[kv[1]] = []; listKey = kv[1]; } else { data[kv[1]] = scalar(kv[2]); listKey = null; }
    }
    return { data, body: text.slice(m[0].length) };
  }

  // ---------------------------------------------------------------- Markdown
  const ABS_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;

  function mdToFragment(md, base) {
    const html = window.marked.parse(md || '', { gfm: true });
    return sanitizeToFragment(html, base);
  }

  function sanitizeToFragment(html, base) {
    const clean = window.DOMPurify.sanitize(html);
    const tpl = document.createElement('template');
    tpl.innerHTML = clean;
    fixup(tpl.content, base);
    return tpl.content;
  }

  function fixup(root, base) {
    $$('img', root).forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (base && src && !ABS_URL.test(src)) img.setAttribute('src', base + src.replace(/^\.\//, ''));
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
    });
    $$('a[href]', root).forEach((a) => {
      const href = a.getAttribute('href');
      if (base && !ABS_URL.test(href)) a.setAttribute('href', base + href.replace(/^\.\//, ''));
      if (/^https?:\/\//i.test(a.getAttribute('href')) && !a.href.startsWith(location.origin)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
    $$('table', root).forEach((t) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      w.setAttribute('tabindex', '0');
      w.setAttribute('role', 'region');
      w.setAttribute('aria-label', '表（横にスクロールできます）');
      t.replaceWith(w);
      w.appendChild(t);
    });
    $$('pre', root).forEach((pre) => {
      const code = pre.querySelector('code');
      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      const lang = code && (code.className.match(/language-([\w+-]+)/) || [])[1];
      pre.replaceWith(wrap);
      if (lang) {
        const l = document.createElement('span');
        l.className = 'code-lang';
        l.textContent = lang;
        wrap.appendChild(l);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'コピー';
      btn.setAttribute('aria-label', 'コードをコピー');
      wrap.appendChild(btn);
      pre.setAttribute('tabindex', '0');
      wrap.appendChild(pre);
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  // ---------------------------------------------------------------- routing
  function parseRoute() {
    let h = location.hash.replace(/^#!?/, '');
    if (!h || h === '/') return { name: 'home', key: '/' };
    if (h[0] !== '/') h = '/' + h;
    const [path, qs = ''] = h.split('?');
    let parts;
    try { parts = path.split('/').filter(Boolean).map(decodeURIComponent); } catch (e) { parts = path.split('/').filter(Boolean); }
    const params = new URLSearchParams(qs);
    const [name, ...rest] = parts;
    const arg = rest.join('/');
    const key = h;
    switch (name) {
      case 'post': return { name: 'post', arg, key };
      case 'tag': case 'category': case 'month': return { name, arg, key };
      case 'search': return { name: 'search', q: params.get('q') || '', key };
      case 'about': case 'tags': case 'categories': case 'archive': return { name, key };
      default: return { name: 'notfound', key };
    }
  }

  function isList(r) { return r && LIST_ROUTES.includes(r.name); }

  // 予約公開：公開日時（日本時間で記録済み）を過ぎた記事だけを表示対象にする。
  // GitHub の定期実行を待たずに、指定時刻ちょうどから表示される。
  function refreshVisible() {
    const now = Date.now();
    const isFuture = (p) => { const t = Date.parse(p.date); return !Number.isNaN(t) && t > now; };
    if (state.preview) {
      // ローカル確認用（--include-drafts）：予約記事も「予約」バッジ付きで表示
      state.posts = state.allPosts.map((p) => (isFuture(p) && !p.status ? Object.assign({}, p, { status: 'scheduled' }) : p));
    } else {
      state.posts = state.allPosts.filter((p) => !isFuture(p));
    }
  }

  function onRouteChange() {
    refreshVisible();
    const prev = state.route;
    if (isList(prev)) {
      state.lastList = { key: prev.key, y: window.scrollY, shown: state.shown };
      saveStore(STORE_KEY, state.lastList);
    }
    const route = parseRoute();
    state.route = route;
    const restore = !!(prev && !isList(prev) && isList(route) && state.lastList && state.lastList.key === route.key);
    render(route, { restore, initial: !prev });
  }

  function cleanup() {
    state.cleanups.forEach((fn) => { try { fn(); } catch (e) { /* 無視 */ } });
    state.cleanups = [];
  }

  async function render(route, opts) {
    cleanup();
    closePanel(true);
    $('#menu').open = false;
    const id = ++state.renderId;
    main.classList.remove('is-wide');
    try {
      switch (route.name) {
        case 'home': renderHome(opts); break;
        case 'tag': renderFiltered(route, opts); break;
        case 'category': renderFiltered(route, opts); break;
        case 'month': renderFiltered(route, opts); break;
        case 'search': await renderSearch(route, opts, id); break;
        case 'post': await renderPost(route, id); break;
        case 'about': await renderAbout(id); break;
        case 'tags': case 'categories': case 'archive': renderTerms(route); break;
        default: renderNotFound();
      }
    } catch (e) {
      console.error(e);
      if (id === state.renderId) {
        main.innerHTML = '<p class="empty">読み込みに失敗しました。時間をおいて再読み込みしてください。</p>';
      }
    }
    if (id !== state.renderId) return;
    if (!(opts && opts.restore) && route.name !== 'search') scrollToY(0, false);
    if (!(opts && opts.initial)) main.focus({ preventScroll: true });
    updateFab();
    trackPage();
  }

  // ---------------------------------------------------------------- list rendering
  function metaHtml(p, opts = {}) {
    const badge = `<span class="badge ${esc(p.type)}">${esc(TYPE_LABEL[p.type] || p.type)}</span>`;
    const status = p.status ? `<span class="badge status">${p.status === 'draft' ? '下書き' : '予約'}</span>` : '';
    const date = `<time datetime="${esc(p.date)}">${esc(formatDate(p))}</time>`;
    const cat = `<a class="chip cat" href="#/category/${enc(p.category)}">${esc(p.category)}</a>`;
    const tags = opts.withTags !== false ? tagsHtml(p) : '';
    return `<div class="meta">${badge}${status}${date}${cat}${tags}</div>`;
  }
  function tagsHtml(p) {
    return (p.tags || []).map((t) => `<a class="chip" href="#/tag/${enc(t)}">#${esc(t)}</a>`).join('');
  }

  function cardHtml(p, extra) {
    const title = extra && extra.titleHtml ? extra.titleHtml : esc(p.title);
    const body = extra && extra.snippetHtml
      ? `<p class="snippet">${extra.snippetHtml}</p>`
      : `<p class="summary">${esc(p.summary || '')}</p>`;
    return `<li class="card">
      <h3><a href="#/post/${enc(p.slug)}">${title}</a></h3>
      ${body}
      ${metaHtml(p)}
    </li>`;
  }

  function heroHtml(p) {
    return `<article class="hero" aria-labelledby="hero-title">
      <p class="hero-label">最新記事</p>
      <h2 id="hero-title"><a href="#/post/${enc(p.slug)}">${esc(p.title)}</a></h2>
      ${metaHtml(p)}
      <p class="summary">${esc(p.summary || '')}</p>
    </article>`;
  }

  // items: 表示対象の配列、itemHtml: 1件の HTML 生成関数
  function mountPagedList(container, items, itemHtml, opts) {
    const size = Math.max(1, +state.config.pageSize || 20);
    state.shown = Math.min(items.length, opts && opts.restore && state.lastList ? Math.max(size, state.lastList.shown || 0) : size);
    const ul = document.createElement('ul');
    ul.className = 'post-list';
    const moreWrap = document.createElement('div');
    moreWrap.className = 'more-wrap';
    const update = () => {
      ul.innerHTML = items.slice(0, state.shown).map(itemHtml).join('');
      const rest = items.length - state.shown;
      moreWrap.innerHTML = rest > 0
        ? `<button type="button" class="btn" id="more-btn">もっと見る（残り ${rest} 件）</button>`
        : '';
    };
    moreWrap.addEventListener('click', (e) => {
      if (!e.target.closest('#more-btn')) return;
      const firstNew = state.shown;
      state.shown = Math.min(items.length, state.shown + size);
      update();
      const link = ul.children[firstNew] && ul.children[firstNew].querySelector('a');
      if (link) link.focus({ preventScroll: true });
    });
    update();
    container.append(ul, moreWrap);
  }

  function restoreScroll(opts) {
    if (opts && opts.restore && state.lastList) {
      const y = state.lastList.y || 0;
      scrollToY(y, false);
      // 画像読み込み等で高さが変わった場合に備えて再調整
      requestAnimationFrame(() => scrollToY(y, false));
    }
  }

  function renderHome(opts) {
    document.title = state.config.title;
    const posts = state.posts;
    main.innerHTML = '';
    if (!posts.length) {
      main.innerHTML = '<p class="empty">まだ記事がありません。</p>';
      return;
    }
    main.insertAdjacentHTML('beforeend', heroHtml(posts[0]));
    const rest = posts.slice(1);
    if (rest.length) {
      main.insertAdjacentHTML('beforeend', '<h2 class="section-title">記事一覧</h2>');
      mountPagedList(main, rest, (p) => cardHtml(p), opts);
    }
    restoreScroll(opts);
  }

  function renderFiltered(route, opts) {
    const v = route.arg;
    let items;
    let label;
    if (route.name === 'tag') {
      items = state.posts.filter((p) => (p.tags || []).includes(v));
      label = `タグ：#${v}`;
    } else if (route.name === 'category') {
      items = state.posts.filter((p) => p.category === v);
      label = `カテゴリー：${v}`;
    } else {
      items = state.posts.filter((p) => p.month === v);
      label = /^\d{4}-\d{2}$/.test(v) ? monthLabel(v) + 'の記事' : v;
    }
    document.title = `${label} | ${state.config.title}`;
    main.innerHTML = `<h1 class="page-title">${esc(label)}<small>${items.length} 件</small></h1>`;
    if (!items.length) {
      main.insertAdjacentHTML('beforeend', '<p class="empty">該当する記事はありません。</p>');
      return;
    }
    mountPagedList(main, items, (p) => cardHtml(p), opts);
    restoreScroll(opts);
  }

  async function loadBodies() {
    if (!state.bodies) {
      try { state.bodies = await fetchJSON('search-index.json'); } catch (e) { state.bodies = {}; }
    }
    return state.bodies;
  }

  async function renderSearch(route, opts, id) {
    const q = route.q.trim();
    document.title = `「${q}」の検索結果 | ${state.config.title}`;
    main.innerHTML = `<h1 class="page-title">「${esc(q)}」の検索結果</h1><p class="loading">検索中…</p>`;
    if (!q) {
      main.innerHTML = '<h1 class="page-title">キーワード検索</h1><p class="empty">キーワードを入力してください。</p>';
      main.insertAdjacentHTML('beforeend', '<p style="text-align:center"><button type="button" class="btn-primary" data-open-panel="keyword">検索パネルを開く</button></p>');
      return;
    }
    const bodies = await loadBodies();
    if (id !== state.renderId) return;
    const results = S.search(state.posts, bodies, q);
    main.innerHTML = `<h1 class="page-title">「${esc(q)}」の検索結果<small>${results.length} 件</small></h1>`;
    if (!results.length) {
      main.insertAdjacentHTML('beforeend', '<p class="empty">見つかりませんでした。別のキーワードやひらがな表記でもお試しください。</p>');
    } else {
      mountPagedList(main, results, (r) => cardHtml(r.post, r), opts);
    }
    if (opts && opts.restore) restoreScroll(opts); else scrollToY(0, false);
  }

  // ---------------------------------------------------------------- terms
  function countBy(fn) {
    const map = new Map();
    for (const p of state.posts) for (const k of fn(p)) map.set(k, (map.get(k) || 0) + 1);
    return map;
  }
  function tagsListHtml(current) {
    const entries = [...countBy((p) => p.tags || []).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
    if (!entries.length) return '<p class="empty">タグはまだありません。</p>';
    return '<ul class="term-list">' + entries.map(([t, n]) =>
      `<li><a href="#/tag/${enc(t)}"${t === current ? ' aria-current="page"' : ''}>#${esc(t)} <span class="count">(${n})</span></a></li>`).join('') + '</ul>';
  }
  function categoriesListHtml(current) {
    const entries = [...countBy((p) => [p.category]).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
    if (!entries.length) return '<p class="empty">カテゴリーはまだありません。</p>';
    return '<ul class="term-list">' + entries.map(([c, n]) =>
      `<li><a href="#/category/${enc(c)}"${c === current ? ' aria-current="page"' : ''}>${esc(c)} <span class="count">(${n})</span></a></li>`).join('') + '</ul>';
  }
  function monthsListHtml() {
    const entries = [...countBy((p) => [p.month]).entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    if (!entries.length) return '<p class="empty">記事はまだありません。</p>';
    let html = '';
    let year = '';
    for (const [ym, n] of entries) {
      const y = ym.slice(0, 4);
      if (y !== year) {
        if (year) html += '</ul>';
        html += `<p class="month-year">${+y}年</p><ul class="month-list">`;
        year = y;
      }
      html += `<li><a href="#/month/${enc(ym)}"><span>${esc(monthLabel(ym))}</span><span class="count">(${n})</span></a></li>`;
    }
    return html + '</ul>';
  }

  function renderTerms(route) {
    const map = {
      tags: ['タグ一覧', tagsListHtml],
      categories: ['カテゴリー一覧', categoriesListHtml],
      archive: ['月別アーカイブ', monthsListHtml],
    };
    const [title, fn] = map[route.name];
    document.title = `${title} | ${state.config.title}`;
    main.innerHTML = `<h1 class="page-title">${title}</h1>${fn()}`;
  }

  function renderNotFound(msg) {
    document.title = `ページが見つかりません | ${state.config.title}`;
    main.innerHTML = `<h1 class="page-title">ページが見つかりません</h1>
      <p>${esc(msg || 'URL が間違っているか、記事が移動・削除された可能性があります。')}</p>
      <p><a class="btn" href="#/">トップへ戻る</a></p>`;
  }

  // ---------------------------------------------------------------- about
  async function renderAbout(id) {
    document.title = `このブログについて | ${state.config.title}`;
    main.innerHTML = '<p class="loading">読み込み中…</p>';
    const text = await fetchText('about.md');
    if (id !== state.renderId) return;
    const { data, body } = parseFrontMatter(text);
    main.innerHTML = '';
    const article = document.createElement('article');
    article.innerHTML = `<header class="post-header"><h1>${esc(data.title || 'このブログについて')}</h1></header>`;
    const prose = document.createElement('div');
    prose.className = 'prose';
    prose.appendChild(mdToFragment(body, ''));
    article.appendChild(prose);
    main.appendChild(article);
  }

  // ---------------------------------------------------------------- post
  async function renderPost(route, id) {
    const slug = route.arg;
    if (!slug || /(^|\/)\.\.(\/|$)/.test(slug)) return renderNotFound();
    main.innerHTML = '<p class="loading">読み込み中…</p>';
    const base = `posts/${slug.split('/').map(enc).join('/')}/`;
    let text;
    try {
      text = await fetchText(base + 'index.md');
    } catch (e) {
      if (id === state.renderId) renderNotFound('記事が見つかりませんでした。');
      return;
    }
    if (id !== state.renderId) return;

    const { data, body } = parseFrontMatter(text);
    const idx = state.posts.findIndex((p) => p.slug === slug);
    const listed = idx !== -1;
    const known = listed ? null : state.allPosts.find((p) => p.slug === slug); // 公開前の予約記事
    const meta = listed ? state.posts[idx] : known ? Object.assign({}, known, { status: known.status || 'scheduled' }) : {
      slug,
      title: String(data.title || slug),
      date: String(data.date || slug.slice(0, 10)).replace(' ', 'T').replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T00:00') + ':00+09:00',
      hasTime: /\d:\d/.test(String(data.date || '')),
      category: data.category ? String(data.category) : '未分類',
      tags: Array.isArray(data.tags) ? data.tags.map(String) : data.tags ? [String(data.tags)] : [],
      type: ['md', 'slides', 'story'].includes(data.type) ? data.type : 'md',
      comments: data.comments !== false,
      status: data.draft === true ? 'draft' : 'scheduled',
    };

    document.title = `${meta.title} | ${state.config.title}`;
    if (meta.type !== 'md') main.classList.add('is-wide');

    const article = document.createElement('article');
    article.className = 'post post-' + meta.type;
    article.innerHTML = `<header class="post-header">
        <h1>${esc(meta.title)}</h1>
        ${metaHtml(meta)}
      </header>`;
    if (!listed) {
      article.insertAdjacentHTML('beforeend',
        '<p class="notice">この記事は一覧に掲載されていません（下書き・予約公開、または一覧への反映待ちです）。</p><br>');
    }

    const content = document.createElement('div');
    content.className = 'post-body';
    article.appendChild(content);

    if (meta.type === 'slides') renderSlides(content, meta, data, body, base);
    else if (meta.type === 'story') renderStory(content, body, base);
    else {
      const prose = document.createElement('div');
      prose.className = 'prose';
      prose.appendChild(mdToFragment(body, base));
      content.appendChild(prose);
    }

    // 前後の記事
    const footer = document.createElement('footer');
    footer.className = 'post-footer';
    if (listed) {
      const newer = state.posts[idx - 1];
      const older = state.posts[idx + 1];
      footer.innerHTML = `<nav class="post-nav" aria-label="前後の記事">
          ${older ? `<a class="prev" href="#/post/${enc(older.slug)}"><small>← 前の記事</small>${esc(older.title)}</a>` : ''}
          ${newer ? `<a class="next" href="#/post/${enc(newer.slug)}"><small>次の記事 →</small>${esc(newer.title)}</a>` : ''}
        </nav>`;
    }
    article.appendChild(footer);

    main.innerHTML = '';
    main.appendChild(article);

    if (meta.comments !== false) mountComments(article, slug);
  }

  // ---- 紙芝居：## 見出しごとに「画像＋テキスト」1セット
  function renderStory(container, body, base) {
    const tokens = window.marked.lexer(body || '');
    const intro = [];
    const scenes = [];
    let cur = null;
    for (const t of tokens) {
      if (t.type === 'heading' && t.depth === 2) {
        cur = { heading: t.text, tokens: [] };
        scenes.push(cur);
      } else (cur ? cur.tokens : intro).push(t);
    }
    const parse = (arr) => {
      arr.links = tokens.links;
      return window.marked.parser(arr);
    };
    if (intro.some((t) => t.type !== 'space')) {
      const div = document.createElement('div');
      div.className = 'prose story-intro';
      div.appendChild(sanitizeToFragment(parse(intro), base));
      container.appendChild(div);
    }
    const wrap = document.createElement('div');
    wrap.className = 'story';
    scenes.forEach((sc, i) => {
      const frag = sanitizeToFragment(parse(sc.tokens), base);
      const headingHtml = window.DOMPurify.sanitize(window.marked.parseInline(sc.heading));
      const section = document.createElement('section');
      section.className = 'story-scene';
      section.setAttribute('aria-labelledby', `scene-${i + 1}`);
      const img = frag.querySelector('img');
      if (img) {
        const parent = img.parentElement;
        const holder = img.closest('a') || img;
        const media = document.createElement('div');
        media.className = 'story-media';
        holder.remove();
        if (parent && parent.tagName === 'P' && !parent.textContent.trim() && !parent.querySelector('img')) parent.remove();
        if (!img.getAttribute('alt')) img.setAttribute('alt', sc.heading.replace(/[*_`#]/g, ''));
        if (i === 0) img.setAttribute('loading', 'eager');
        media.appendChild(holder);
        section.appendChild(media);
      } else {
        section.style.gridTemplateColumns = '1fr';
      }
      const textDiv = document.createElement('div');
      textDiv.className = 'story-text prose';
      textDiv.innerHTML = `<h2 id="scene-${i + 1}">${headingHtml}</h2>`;
      textDiv.appendChild(frag);
      section.appendChild(textDiv);
      wrap.appendChild(section);
    });
    container.appendChild(wrap);
  }

  // ---- スライド
  function renderSlides(container, meta, data, body, base) {
    let s = meta.slides;
    if (!s) {
      // 一覧に無い記事（下書き等）はフロントマターの slides: 指定から推測
      s = { images: [], pdf: null, html: null, pptx: null };
      const spec = typeof data.slides === 'string' ? data.slides : '';
      if (/\.pdf$/i.test(spec)) s.pdf = spec;
      else if (/\.html?$/i.test(spec)) s.html = spec;
      else if (/\.pptx?$/i.test(spec)) s.pptx = spec;
      else if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(spec)) s.images = [spec];
    }
    const url = (f) => base + String(f).split('/').map(enc).join('/');
    let any = false;

    if (s.images && s.images.length) {
      container.appendChild(buildSlideViewer(s.images.map(url), meta.title));
      any = true;
    } else if (s.html) {
      const wrap = document.createElement('div');
      wrap.className = 'frame-wrap';
      wrap.innerHTML = `<iframe src="${esc(url(s.html))}" title="${esc(meta.title)}（スライド）" loading="lazy" allowfullscreen></iframe>
        <div class="slides-bar">
          <a class="btn" href="${esc(url(s.html))}" target="_blank" rel="noopener">新しいタブで開く</a>
          <div class="group"><button type="button" class="icon-btn" data-fs aria-label="全画面表示">${ICON.fs}</button></div>
        </div>`;
      setupFullscreen(wrap, $('[data-fs]', wrap));
      container.appendChild(wrap);
      any = true;
    } else if (s.pdf) {
      container.insertAdjacentHTML('beforeend',
        `<iframe class="pdf-frame" src="${esc(url(s.pdf))}" title="${esc(meta.title)}（PDF）" loading="lazy"></iframe>`);
      any = true;
    }

    const dl = [];
    if (s.pdf) {
      dl.push(`<a class="btn" href="${esc(url(s.pdf))}" target="_blank" rel="noopener">PDF を開く</a>`);
      dl.push(`<a class="btn" href="${esc(url(s.pdf))}" download>PDF をダウンロード</a>`);
    }
    if (s.pptx) dl.push(`<a class="btn" href="${esc(url(s.pptx))}" download>PowerPoint をダウンロード</a>`);
    if (dl.length) {
      container.insertAdjacentHTML('beforeend', `<div class="downloads">${dl.join('')}</div>`);
      if (s.pptx && !any) {
        container.insertAdjacentHTML('beforeend',
          '<p class="notice">PowerPoint ファイルはブラウザで直接表示できません。ダウンロードしてご覧ください。</p>');
      }
      any = true;
    }
    if (!any) container.insertAdjacentHTML('beforeend', '<p class="notice">スライドが見つかりませんでした。</p>');

    if (body && body.trim()) {
      const prose = document.createElement('div');
      prose.className = 'prose slides-note';
      prose.appendChild(mdToFragment(body, base));
      container.appendChild(prose);
    }
  }

  const ICON = {
    prev: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fs: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  function buildSlideViewer(srcs, title) {
    const n = srcs.length;
    let i = 0;
    const wrap = document.createElement('div');
    wrap.className = 'slides-wrap';
    wrap.innerHTML = `
      <div class="slides-viewer" role="region" aria-roledescription="スライド" aria-label="${esc(title)}（左右キーまたはスワイプで移動）" tabindex="0">
        <div class="slides-stage"><img alt="" decoding="async"></div>
      </div>
      <div class="slides-bar">
        <div class="group">
          <button type="button" class="icon-btn" data-prev aria-label="前のスライド">${ICON.prev}</button>
          <button type="button" class="icon-btn" data-next aria-label="次のスライド">${ICON.next}</button>
        </div>
        <span class="slides-counter" aria-live="polite"></span>
        <div class="group"><button type="button" class="icon-btn" data-fs aria-label="全画面表示">${ICON.fs}</button></div>
      </div>
      ${n > 1 ? `<div class="slides-thumbs" role="group" aria-label="スライド一覧">${srcs.map((s, k) =>
        `<button type="button" data-go="${k}" aria-label="スライド ${k + 1}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`;
    const img = $('.slides-stage img', wrap);
    const counter = $('.slides-counter', wrap);
    const prev = $('[data-prev]', wrap);
    const next = $('[data-next]', wrap);
    const thumbs = $$('[data-go]', wrap);
    const show = (k) => {
      i = Math.max(0, Math.min(n - 1, k));
      img.src = srcs[i];
      img.alt = `${title} スライド ${i + 1} / ${n}`;
      counter.textContent = `${i + 1} / ${n}`;
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
      thumbs.forEach((b, k2) => b.setAttribute('aria-current', k2 === i ? 'true' : 'false'));
      // サムネイル列だけを横にスクロール（ページ全体は動かさない）
      const strip = thumbs[i] && thumbs[i].parentElement;
      if (strip) {
        const t = thumbs[i];
        if (t.offsetLeft < strip.scrollLeft) strip.scrollLeft = t.offsetLeft - 8;
        else if (t.offsetLeft + t.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = t.offsetLeft + t.offsetWidth - strip.clientWidth + 8;
      }
      [i - 1, i + 1].forEach((k2) => { if (srcs[k2]) { const pre = new Image(); pre.src = srcs[k2]; } });
    };
    prev.addEventListener('click', () => show(i - 1));
    next.addEventListener('click', () => show(i + 1));
    thumbs.forEach((b) => b.addEventListener('click', () => show(+b.dataset.go)));

    // スワイプ
    const viewer = $('.slides-viewer', wrap);
    let sx = null;
    let sy = 0;
    viewer.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    viewer.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1));
    });
    viewer.addEventListener('pointercancel', () => { sx = null; });

    // キーボード（ページ上のどこでも ← →。入力中・パネル表示中は無効）
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      if (!$('#search-sheet').hidden || !$('#lightbox').hidden) return;
      if (e.key === 'ArrowLeft') { show(i - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    state.cleanups.push(() => document.removeEventListener('keydown', onKey));

    setupFullscreen(wrap, $('[data-fs]', wrap));
    show(0);
    return wrap;
  }

  function setupFullscreen(wrap, btn) {
    const native = !!(wrap.requestFullscreen && document.fullscreenEnabled);
    const exitPseudo = () => {
      wrap.classList.remove('is-fullscreen');
      document.body.classList.remove('no-scroll');
      btn.setAttribute('aria-label', '全画面表示');
    };
    btn.addEventListener('click', () => {
      if (native) {
        if (document.fullscreenElement) document.exitFullscreen();
        else wrap.requestFullscreen().catch(() => {});
        return;
      }
      // iPhone Safari など：疑似全画面
      if (wrap.classList.contains('is-fullscreen')) exitPseudo();
      else {
        wrap.classList.add('is-fullscreen');
        document.body.classList.add('no-scroll');
        btn.setAttribute('aria-label', '全画面表示を終了');
      }
    });
    const onKey = (e) => { if (e.key === 'Escape' && wrap.classList.contains('is-fullscreen')) exitPseudo(); };
    document.addEventListener('keydown', onKey);
    state.cleanups.push(() => {
      document.removeEventListener('keydown', onKey);
      exitPseudo();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    });
  }

  // ---------------------------------------------------------------- giscus
  function mountComments(article, slug) {
    const c = state.config.comments || {};
    if (!c.repo || !c.repoId || !c.category || !c.categoryId) return; // 未設定なら表示しない
    const box = document.createElement('section');
    box.className = 'comments';
    box.setAttribute('aria-label', 'コメント');
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    const attrs = {
      'data-repo': c.repo,
      'data-repo-id': c.repoId,
      'data-category': c.category,
      'data-category-id': c.categoryId,
      'data-mapping': 'specific',
      'data-term': slug,
      'data-strict': '1',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'bottom',
      'data-theme': 'preferred_color_scheme',
      'data-lang': 'ja',
      'data-loading': 'lazy',
      crossorigin: 'anonymous',
    };
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.async = true;
    box.appendChild(s);
    article.appendChild(box);
  }

  // ---------------------------------------------------------------- GoatCounter
  const analytics = { enabled: false, ready: false, pending: null };
  function isLocalHost() {
    const h = location.hostname;
    return !h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.local') || location.protocol === 'file:';
  }
  function initAnalytics() {
    const code = String((state.config.analytics || {}).goatcounter || '').trim();
    if (!code || isLocalHost()) return;
    analytics.enabled = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', /^https?:\/\//.test(code) ? code : `https://${code}.goatcounter.com/count`);
    s.setAttribute('data-goatcounter-settings', '{"no_onload": true}');
    s.onload = () => {
      analytics.ready = true;
      if (analytics.pending) sendCount(analytics.pending);
      analytics.pending = null;
    };
    document.head.appendChild(s);
  }
  function sendCount(hit) {
    try { window.goatcounter.count(hit); } catch (e) { /* 無視 */ }
  }
  function trackPage() {
    if (!analytics.enabled || !state.route) return;
    let path = state.route.key;
    try { path = decodeURIComponent(path); } catch (e) { /* そのまま */ } // 日本語をダッシュボードで読めるように
    const hit = { path, title: document.title };
    if (analytics.ready && window.goatcounter && window.goatcounter.count) sendCount(hit);
    else analytics.pending = hit;
  }

  // ---------------------------------------------------------------- 検索パネル
  let lastFocus = null;
  let currentTab = loadStore('bom:tab') || 'tag';

  function openPanel(tab) {
    const sheet = $('#search-sheet');
    $('#menu').open = false;
    $('[data-panel="tag"]').innerHTML = tagsListHtml(state.route && state.route.name === 'tag' ? state.route.arg : null);
    $('[data-panel="month"]').innerHTML = monthsListHtml();
    $('[data-panel="category"]').innerHTML = categoriesListHtml(state.route && state.route.name === 'category' ? state.route.arg : null);
    if (state.route && state.route.name === 'search') $('#search-input').value = state.route.q;
    if (sheet.hidden) lastFocus = document.activeElement;
    sheet.hidden = false;
    $('#sheet-backdrop').hidden = false;
    document.body.classList.add('no-scroll');
    selectTab(tab || currentTab, true);
    loadBodies(); // キーワード検索に備えて先読み
  }

  function closePanel(silent) {
    const sheet = $('#search-sheet');
    if (sheet.hidden) return;
    sheet.hidden = true;
    $('#sheet-backdrop').hidden = true;
    document.body.classList.remove('no-scroll');
    if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  function selectTab(tab, focus) {
    currentTab = tab;
    saveStore('bom:tab', tab);
    $$('.tabs [role="tab"]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    $('.sheet-body').scrollTop = 0;
    if (focus) {
      if (tab === 'keyword') $('#search-input').focus();
      else $(`.tabs [data-tab="${tab}"]`).focus();
    }
  }

  function setupPanel() {
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open-panel]');
      if (opener) { e.preventDefault(); openPanel(opener.dataset.openPanel); }
    });
    $('#sheet-close').addEventListener('click', () => closePanel());
    $('#sheet-backdrop').addEventListener('click', () => closePanel());
    $('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) selectTab(b.dataset.tab, b.dataset.tab === 'keyword');
    });
    $('.tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tabs = $$('.tabs [role="tab"]');
      const k = tabs.findIndex((b) => b.dataset.tab === currentTab);
      const nk = (k + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[nk].dataset.tab, false);
      tabs[nk].focus();
      e.preventDefault();
    });
    $('.sheet-body').addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#/"]');
      if (!a) return;
      // 同じ URL をもう一度選んだ場合も閉じる
      if (a.getAttribute('href') === location.hash) closePanel();
    });
    $('#search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#search-input').value.trim();
      if (!q) { $('#search-input').focus(); return; }
      const target = '#/search?q=' + enc(q);
      if (location.hash === target) closePanel(); else location.hash = target;
      $('#search-input').blur();
    });
    // Esc で閉じる・フォーカスをパネル内に閉じ込める
    $('#search-sheet').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePanel(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('button, a[href], input', $('#search-sheet')).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });
  }

  // ---------------------------------------------------------------- 固定ボタン
  function updateFab() {
    const fab = $('#fab');
    const show = window.scrollY > 300;
    if (fab.hidden === show) fab.hidden = !show;
    const back = $('#fab-back');
    back.setAttribute('aria-label', isList(state.route) ? '一覧の先頭へ戻る' : '一覧へ戻る');
  }

  function setupFab() {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; updateFab(); });
    }, { passive: true });
    $('#fab-search').addEventListener('click', () => openPanel());
    $('#fab-back').addEventListener('click', () => {
      if (isList(state.route)) {
        scrollToY(0, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        return;
      }
      const target = state.lastList ? '#' + state.lastList.key : '#/';
      if (location.hash === target || (target === '#/' && !location.hash)) render(parseRoute(), {});
      else location.hash = target;
    });
  }

  // ---------------------------------------------------------------- ライトボックス
  function setupLightbox() {
    const box = $('#lightbox');
    const img = $('#lightbox-img');
    const cap = $('#lightbox-caption');
    let opener = null;
    const close = () => {
      if (box.hidden) return;
      box.hidden = true;
      img.removeAttribute('src');
      document.body.classList.remove('no-scroll');
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    main.addEventListener('click', (e) => {
      const t = e.target;
      const copy = t.closest('.copy-btn');
      if (copy) {
        const code = copy.parentElement.querySelector('pre');
        copyText(code ? code.innerText.replace(/\n$/, '') : '').then((ok) => {
          copy.textContent = ok ? 'コピーしました' : 'コピー失敗';
          setTimeout(() => { copy.textContent = 'コピー'; }, 1600);
        });
        return;
      }
      if (t.tagName !== 'IMG' || t.closest('a') || !t.closest('.prose, .story-media')) return;
      opener = t;
      img.src = t.currentSrc || t.src;
      img.alt = t.alt || '';
      cap.textContent = t.alt || '';
      box.hidden = false;
      document.body.classList.add('no-scroll');
      $('#lightbox-close').focus();
    });
    // キーボードで画像を開けるように
    main.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName === 'IMG') { e.preventDefault(); e.target.click(); }
    });
    box.addEventListener('click', (e) => { if (e.target !== img) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    state.lightboxClose = close;
  }

  // ---------------------------------------------------------------- 初期化
  function applyConfig() {
    const c = state.config;
    $('#site-title').textContent = c.title;
    $('#footer-title').textContent = c.title;
    $('#footer-year').textContent = String(new Date().getFullYear());
    if (Array.isArray(c.subtitles)) $('#site-subtitle').innerHTML = c.subtitles.map((s) => `<span>${esc(s)}</span>`).join('');
    if (c.icon) {
      $('#site-icon').src = c.icon;
      const link = document.querySelector('link[rel="icon"]');
      if (link) { link.href = c.icon; link.type = /\.svg$/i.test(c.icon) ? 'image/svg+xml' : ''; }
    }
    if (c.eyecatch) $('#site-eyecatch').src = c.eyecatch;
    $('#site-eyecatch').alt = c.eyecatchAlt || '';
    if (c.description) {
      const m = document.querySelector('meta[name="description"]');
      if (m) m.content = c.description;
    }
  }

  // 本文中の画像をキーボードでも拡大できるようにする
  const observer = new MutationObserver(() => {
    $$('.prose img:not([tabindex]), .story-media img:not([tabindex])', main).forEach((img) => {
      if (img.closest('a')) return;
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (img.alt ? img.alt + '（' : '（') + '拡大表示）');
    });
  });

  async function init() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    try {
      const cfg = await fetchJSON('site.config.json');
      state.config = Object.assign({}, DEFAULT_CONFIG, cfg, {
        comments: Object.assign({}, DEFAULT_CONFIG.comments, cfg.comments),
        analytics: Object.assign({}, DEFAULT_CONFIG.analytics, cfg.analytics),
      });
    } catch (e) { console.warn('site.config.json を読み込めませんでした', e); }
    applyConfig();
    try {
      const data = await fetchJSON('posts.json');
      state.allPosts = Array.isArray(data) ? data : (data.posts || []);
      state.preview = !!(data && data.preview);
    } catch (e) {
      console.warn('posts.json を読み込めませんでした', e);
      state.allPosts = [];
    }
    refreshVisible();
    observer.observe(main, { childList: true, subtree: true });
    setupPanel();
    setupFab();
    setupLightbox();
    initAnalytics();
    window.addEventListener('hashchange', onRouteChange);
    // メニュー外クリックで閉じる
    document.addEventListener('click', (e) => {
      const menu = $('#menu');
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#menu').open) { $('#menu').open = false; $('.menu-button').focus(); }
    });
    $('#menu').addEventListener('click', (e) => {
      if (e.target.closest('.menu-panel a')) $('#menu').open = false;
    });
    onRouteChange();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
