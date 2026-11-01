/* B.O.M. — キーワード検索（日本語向け部分一致）
 * 正規化：NFKC（全角/半角の統一）→ 小文字化 → カタカナをひらがなへ
 * 複数キーワードはスペース区切りで AND。
 */
(function () {
  'use strict';

  function kataToHira(s) {
    return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  // 文字数を変えない正規化（NFKC 済みの文字列に対して使う）
  function fold(s) {
    let out = '';
    for (const ch of s) {
      const l = ch.toLowerCase();
      out += l.length === ch.length ? l : ch; // 長さが変わる特殊文字はそのまま
    }
    return kataToHira(out);
  }

  function normalize(s) {
    return fold(String(s || '').normalize('NFKC'));
  }

  function splitQuery(q) {
    return normalize(q).split(/[\s　]+/).filter(Boolean);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 表示用テキスト disp（NFKC済）に対して、正規化テキスト上の一致位置を <mark> で強調
  function highlight(disp, terms) {
    const norm = fold(disp);
    const ranges = [];
    for (const t of terms) {
      let i = 0;
      while ((i = norm.indexOf(t, i)) !== -1) {
        ranges.push([i, i + t.length]);
        i += t.length;
      }
    }
    if (!ranges.length) return escapeHtml(disp);
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r.slice());
    }
    let html = '';
    let pos = 0;
    for (const [s, e] of merged) {
      html += escapeHtml(disp.slice(pos, s)) + '<mark>' + escapeHtml(disp.slice(s, e)) + '</mark>';
      pos = e;
    }
    return html + escapeHtml(disp.slice(pos));
  }

  // 一致箇所の前後を抜粋
  function snippet(body, terms, radius) {
    radius = radius || 50;
    const disp = String(body || '').normalize('NFKC').replace(/\s+/g, ' ');
    const norm = fold(disp);
    let at = -1;
    for (const t of terms) {
      const i = norm.indexOf(t);
      if (i !== -1 && (at === -1 || i < at)) at = i;
    }
    if (at === -1) return '';
    const start = Math.max(0, at - radius);
    const end = Math.min(disp.length, at + radius * 2);
    return (start > 0 ? '…' : '') + highlight(disp.slice(start, end), terms) + (end < disp.length ? '…' : '');
  }

  /**
   * posts: posts.json の配列 / bodies: { slug: 本文 } / q: 検索語
   * 戻り値: [{ post, snippetHtml, titleHtml, score }]
   */
  function search(posts, bodies, q) {
    const terms = splitQuery(q);
    if (!terms.length) return [];
    const results = [];
    for (const p of posts) {
      const fields = {
        title: normalize(p.title),
        meta: normalize([p.summary, p.category, (p.tags || []).join(' ')].join(' ')),
        body: normalize(bodies[p.slug] || ''),
      };
      const all = fields.title + '\n' + fields.meta + '\n' + fields.body;
      if (!terms.every((t) => all.includes(t))) continue;
      let score = 0;
      for (const t of terms) {
        if (fields.title.includes(t)) score += 10;
        if (fields.meta.includes(t)) score += 4;
        if (fields.body.includes(t)) score += 1;
      }
      results.push({
        post: p,
        score,
        titleHtml: highlight(String(p.title).normalize('NFKC'), terms),
        snippetHtml: snippet(bodies[p.slug], terms) || highlight(String(p.summary || '').normalize('NFKC'), terms),
      });
    }
    // 新しい順を基本に、タイトル一致を少し優先
    results.sort((a, b) => (b.score >= 10) - (a.score >= 10) || (a.post.date < b.post.date ? 1 : -1));
    return results;
  }

  window.BOMSearch = { normalize, splitQuery, highlight, snippet, search, escapeHtml, escapeRe };
})();
