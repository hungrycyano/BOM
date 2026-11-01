#!/usr/bin/env node
// posts/ フォルダを走査して posts.json（記事メタ）と search-index.json（検索用本文）を生成する。
//
//   node scripts/build-index.mjs                  … 本番用（下書きは除外）
//   node scripts/build-index.mjs --include-drafts … ローカル確認用（下書きも含め、予約記事も時刻前から表示）
//
// 予約記事（date が未来）は posts.json に含め、ブラウザ側（app.js）が公開時刻を過ぎるまで隠す。
// そのため、予約公開のために定期実行する必要はない。
//
// 外部パッケージ不要（Node.js 18 以上）。

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const INCLUDE_DRAFTS = process.argv.includes('--include-drafts');
const BODY_LIMIT = 5000; // 検索用本文の上限文字数
const SUMMARY_LENGTH = 120;
const TYPES = ['md', 'slides', 'story'];
const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

// ---------- フロントマター（簡易 YAML） ----------
function parseScalar(v) {
  v = v.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => parseScalar(s)).filter((s) => s !== '');
  }
  if (/^(true|yes|on)$/i.test(v)) return true;
  if (/^(false|no|off)$/i.test(v)) return false;
  return v;
}

export function parseFrontMatter(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!m) return { data: {}, body: text };
  const data = {};
  let listKey = null;
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\s+#.*$/, ''); // 行末コメント
    if (!line.trim()) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(parseScalar(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value.trim() === '') {
      data[key] = [];
      listKey = key;
    } else {
      data[key] = parseScalar(value);
      listKey = null;
    }
  }
  return { data, body: text.slice(m[0].length) };
}

// ---------- 日付（日本時間） ----------
// "2026-11-01" / "2026-11-05 09:00" / "2026-11-05T09:00" → Date
export function parseJstDate(v) {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}+09:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : { date, iso, hasTime: m[4] !== undefined };
}

// ---------- Markdown → プレーンテキスト ----------
export function stripMarkdown(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[^\n]*\n([\s\S]*?)```/g, ' $1 ') // コードは中身を残す（コマンド検索用）
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, ' ')
    .replace(/[ \t　]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

async function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await listFiles(p, base)));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

// スライドのソースを判別する
async function detectSlides(postDir, spec) {
  const files = await listFiles(postDir);
  const result = { images: [], pdf: null, html: null, pptx: null };
  const pick = (f) => {
    if (IMAGE_RE.test(f)) result.images.push(f);
    else if (/\.pdf$/i.test(f)) result.pdf ??= f;
    else if (/\.html?$/i.test(f)) result.html ??= f;
    else if (/\.pptx?$/i.test(f)) result.pptx ??= f;
  };
  if (typeof spec === 'string' && spec) {
    const clean = spec.replace(/^\.\//, '');
    if (clean.endsWith('/')) files.filter((f) => f.startsWith(clean) && IMAGE_RE.test(f)).forEach(pick);
    else pick(clean);
    // 指定ファイル以外にも PDF / PPTX があればダウンロード用に拾う
    for (const f of files) {
      if (/\.pdf$/i.test(f)) result.pdf ??= f;
      if (/\.pptx?$/i.test(f)) result.pptx ??= f;
    }
  } else {
    // 自動判別：slides/ 内の画像 → slides.pdf 等 → slide.html 等 → .pptx
    files.filter((f) => f.startsWith('slides/') && IMAGE_RE.test(f)).forEach((f) => result.images.push(f));
    for (const f of files) {
      if (f.includes('/')) continue;
      if (/\.pdf$/i.test(f)) result.pdf ??= f;
      else if (/\.html?$/i.test(f)) result.html ??= f;
      else if (/\.pptx?$/i.test(f)) result.pptx ??= f;
    }
  }
  return result;
}

async function main() {
  const now = new Date();
  const posts = [];
  const search = {};
  const warnings = [];
  let skipped = 0;
  let scheduled = 0;

  const dirs = existsSync(POSTS_DIR) ? await readdir(POSTS_DIR, { withFileTypes: true }) : [];
  for (const ent of dirs) {
    if (!ent.isDirectory() || ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    const slug = ent.name;
    const postDir = path.join(POSTS_DIR, slug);
    const mdPath = path.join(postDir, 'index.md');
    if (!existsSync(mdPath)) {
      warnings.push(`${slug}: index.md がありません（スキップ）`);
      continue;
    }
    const { data, body } = parseFrontMatter(await readFile(mdPath, 'utf8'));

    // 日付：フロントマター → フォルダ名の日付 → ファイル更新日時
    let d = parseJstDate(data.date) || parseJstDate(slug);
    if (!d) {
      const st = await stat(mdPath);
      d = { date: st.mtime, iso: st.mtime.toISOString(), hasTime: true };
      warnings.push(`${slug}: date が読めないため更新日時を使用`);
    }
    const draft = data.draft === true;
    const future = d.date.getTime() > now.getTime();
    if (draft && !INCLUDE_DRAFTS) {
      skipped++;
      continue;
    }
    if (future) scheduled++;

    let type = String(data.type || 'md').toLowerCase();
    if (!TYPES.includes(type)) {
      warnings.push(`${slug}: type "${type}" は不明なため md として扱います`);
      type = 'md';
    }
    const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).map(String).filter(Boolean);
    const text = stripMarkdown(body);
    const summary = data.summary
      ? String(data.summary)
      : text.replace(/\n/g, ' ').slice(0, SUMMARY_LENGTH) + (text.length > SUMMARY_LENGTH ? '…' : '');

    const jst = new Date(d.date.getTime() + 9 * 3600 * 1000);
    const post = {
      slug,
      title: String(data.title || slug),
      date: d.iso,
      hasTime: d.hasTime,
      month: jst.toISOString().slice(0, 7),
      category: data.category ? String(data.category) : '未分類',
      tags,
      type,
      summary,
      comments: data.comments !== false,
    };
    if (draft) post.status = 'draft'; // --include-drafts のときだけここに来る
    if (type === 'slides') post.slides = await detectSlides(postDir, data.slides);
    posts.push(post);
    search[slug] = text.slice(0, BODY_LIMIT);
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? 1 : -1));

  const write = async (file, obj) => {
    const json = JSON.stringify(obj, null, 1) + '\n';
    const full = path.join(ROOT, file);
    const old = existsSync(full) ? await readFile(full, 'utf8') : '';
    if (old !== json) await writeFile(full, json);
    return old !== json;
  };
  // preview: true のとき、ブラウザは予約記事も時刻前から表示する（ローカル確認用）
  const changed1 = await write('posts.json', INCLUDE_DRAFTS ? { preview: true, posts } : { posts });
  const changed2 = await write('search-index.json', search);

  for (const w of warnings) console.warn('⚠ ' + w);
  console.log(
    `posts.json: ${posts.length} 件` +
      (scheduled ? `（うち予約 ${scheduled} 件：公開時刻まで非表示）` : '') +
      (skipped ? `（下書き ${skipped} 件を除外）` : '') +
      (INCLUDE_DRAFTS ? '［--include-drafts］' : '') +
      (changed1 || changed2 ? ' … 更新しました' : ' … 変更なし'),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
