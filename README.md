# B.O.M.　ボム

**Bit Of Madness（少しの狂気） / Behavioral Optimization Module（行動最適化モジュール）**

AI・PC・スマホ・カーナビなど、増え続ける日常使いの IT システムの説明書（備忘録）ブログです。
GitHub Pages で公開する、ビルドサーバ不要の静的サイトです（HTML / CSS / JavaScript のみ）。

---

## 目次

1. [はじめに：GitHub Pages で公開する](#1-はじめにgithub-pages-で公開する)
2. [記事の追加手順](#2-記事の追加手順)
3. [アップロード手順（Windows / iPhone）](#3-アップロード手順windows--iphone)
4. [記事の3つの形式](#4-記事の3つの形式)
5. [下書き・予約公開](#5-下書き予約公開)
6. [アイコン・アイキャッチの差し替え](#6-アイコンアイキャッチの差し替え)
7. [「このブログについて」の編集](#7-このブログについての編集)
8. [コメント欄（giscus）の設定](#8-コメント欄giscusの設定)
9. [アクセス解析（GoatCounter）の設定](#9-アクセス解析goatcounterの設定)
10. [設定ファイル site.config.json](#10-設定ファイル-siteconfigjson)
11. [手元（パソコン）で確認する](#11-手元パソコンで確認する)
12. [ファイル構成](#12-ファイル構成)

---

## 1. はじめに：GitHub Pages で公開する

最初に一度だけ行います。

1. GitHub でこのリポジトリを開く
2. 上のタブの **Settings**（設定）→ 左メニューの **Pages** を開く
3. 「Build and deployment」の **Source** を **Deploy from a branch** にする
4. **Branch** を `main`、フォルダを `/ (root)` にして **Save**
5. 数分待つと、ページ上部に公開 URL（例：`https://hungrycyano.github.io/BOM/`）が表示されます

続けて、記事一覧を自動更新する GitHub Actions に書き込み権限を与えます。

1. **Settings** → **Actions** → **General** を開く
2. 一番下の「Workflow permissions」で **Read and write permissions** を選んで **Save**

> 💡 記事一覧（`posts.json`）は GitHub Actions が自動で作り直します。自分で編集する必要はありません。

---

## 2. 記事の追加手順

1. `posts/` の中に `日付-スラッグ` という名前のフォルダを作る
   例：`posts/2026-11-05-iphone-backup/`
   - スラッグ＝URL に使う短い英数字の名前（半角英数字とハイフン推奨）
2. そのフォルダに `index.md` を作る（先頭のフロントマターは必須）
   ```yaml
   ---
   title: iPhone のバックアップ手順
   date: 2026-11-05          # 時刻も書ける：2026-11-05 09:00（日本時間）
   draft: false              # true で下書き（非公開）
   category: スマホ           # 1記事に1つ
   tags: [iPhone, バックアップ]  # いくつでも
   type: md                  # md（記事） | slides（スライド） | story（紙芝居）
   summary: 一覧に出す短い説明（省略すると本文の冒頭から自動で作られます）
   comments: true            # false でこの記事のコメント欄を出さない
   ---

   ここから本文（Markdown）。
   ```
3. 画像やスライドは**同じフォルダ**に置く（本文からは `![説明](画像.png)` のように相対パスで参照）
4. 下書きなら `draft: true`、予約公開なら `date` に未来の日時を書く
5. GitHub に push（アップロード）する → 次の章を参照
6. GitHub Actions が `posts.json` を作り直し、**数分で公開に反映**されます
   （予約記事は、指定時刻を過ぎた後の毎時の自動実行で反映。最大1時間ほど遅れることがあります）

> 💡 一番手軽なのは、サンプル記事のフォルダ（`posts/2026-11-01-sample-md/` など）を丸ごとコピーして書き換える方法です。サンプル記事が不要になったらフォルダごと削除してください。

---

## 3. アップロード手順（Windows / iPhone）

### Windows 11（ブラウザ）から

**新しい記事を作る**

1. ブラウザで GitHub のリポジトリを開き、`posts` フォルダをクリック
2. 右上の **Add file** → **Create new file**
3. ファイル名の欄に `2026-11-05-iphone-backup/index.md` のように入力
   （`/` を入力するとフォルダが自動で作られます）
4. 本文欄にフロントマターと本文を書く
5. 右上の **Commit changes...** → もう一度 **Commit changes** を押す

**画像を追加する**

1. 作成した記事フォルダ（例：`posts/2026-11-05-iphone-backup/`）を開く
2. **Add file** → **Upload files**
3. エクスプローラーから画像をドラッグ＆ドロップ
4. **Commit changes** を押す

> 💡 フォルダの中にさらにフォルダ（例：スライドの `slides/`）を作りたいときは、エクスプローラーで `slides` フォルダごとドラッグ＆ドロップすると、そのまま作られます。

### iPhone（Safari）から

1. Safari で GitHub のリポジトリを開き、ログインする
   - 画面が狭くて操作しにくい場合は、アドレスバーの「ぁあ」→ **デスクトップ用Webサイトを表示** にすると、Windows と同じ画面になります
2. `posts` フォルダを開き、**Add file**（＋ボタン）→ **Create new file**
3. ファイル名に `2026-11-05-xxxx/index.md` と入力し、本文を書いて **Commit changes**
4. 画像は、記事フォルダを開いて **Add file** → **Upload files** → **写真ライブラリ** から選ぶ → **Commit changes**

> ⚠ iPhone の写真は HEIC 形式のことがあります。アップロード時に自動で JPEG に変換されることが多いですが、ファイル名が `.heic` のままの場合は、本文の画像パスも同じ名前にしてください（Safari は HEIC を表示できます。Windows のブラウザでは表示できない場合があるので、設定 →「カメラ」→「フォーマット」→ **互換性優先** にしておくのがおすすめです）。

> 💡 GitHub の iPhone アプリはファイル編集が限られているため、記事の追加は **Safari** がおすすめです。

---

## 4. 記事の3つの形式

### 形式1：記事（`type: md`）

ふつうの Markdown 記事です。見出し・リスト・表・コードブロック（コピーボタン付き）・画像・リンクが使えます。
サンプル：`posts/2026-11-01-sample-md/`

### 形式2：スライド（`type: slides`）

次のどれかのファイルを記事フォルダに置くと、自動で判別して表示します。

| 方法 | 置くファイル | 表示 |
|---|---|---|
| **B. 画像連番（推奨）** | `slides/01.png`, `slides/02.png` … | スライドビューア（左右スワイプ・ボタン・← → キー・全画面） |
| A. PDF | `slides.pdf` | PC では埋め込み表示＋「開く／ダウンロード」ボタン。スマホではボタンのみ |
| C. HTML スライド | `slide.html` | 埋め込み表示（全画面ボタン付き）。Claude の Artifacts で作ったスライドを HTML で保存したもの等 |
| D. PowerPoint | `xxx.pptx` | ブラウザで表示できないため、ダウンロードボタンのみ |

- iPhone の Safari は PDF の埋め込み表示が苦手なので、**画像連番がおすすめ**です。
- **PowerPoint / PDF を画像にする方法**：PowerPoint で「ファイル」→「エクスポート」→「ファイルの種類の変更」→ **PNG** を選ぶと、全スライドが画像で保存されます。ファイル名を `01.png`, `02.png` … に変えて `slides/` フォルダへ入れてください（`スライド1.PNG` のような名前でも、数字順に並びます）。
- 特定のファイルを使いたい場合は、フロントマターで `slides: slides/`（フォルダ）や `slides: deck.pdf` のように指定できます。
- `index.md` に本文があれば、スライドの下に補足として表示されます。

サンプル：`posts/2026-11-01-sample-slides/`

### 形式3：紙芝居（`type: story`）

「画像＋テキスト」を1セットとして縦に並べます。**PC では左に画像・右にテキスト**、**スマホでは上に画像・下にテキスト**になります。画像はタップで拡大できます。

```markdown
## 1. ここが最初のステップ
![説明文](img/01.png)

ここにテキスト。**Markdown 使用可**。

## 2. 次のステップ
![説明文](img/02.png)

次のテキスト。
```

- `##` 見出しごとに1セット。セットの中の**最初の画像**が画像側に、残りがテキスト側に出ます。
- 画像の `[説明文]` は必ず書いてください（読み上げや画像が出ないときに使われます）。
- 最初の `##` より前に書いた文章は、紙芝居の前置きとして表示されます。

サンプル：`posts/2026-11-01-sample-story/`

---

## 5. 下書き・予約公開

| やりたいこと | 書き方 |
|---|---|
| 下書き（非公開） | `draft: true` |
| 予約公開 | `date: 2026-12-01 09:00`（未来の日時。日本時間） |
| 日付だけ指定 | `date: 2026-12-01` → その日の 0:00 に公開扱い |

- 下書き・予約記事は、一覧・検索・タグ・カテゴリー・月別・最新記事の**どこにも出ません**。
- 予約記事は、GitHub Actions が**毎時**自動で一覧を作り直すため、公開時刻を過ぎると自動で載ります（最大1時間ほど遅れます）。
- 並び順と月別アーカイブは `date`（公開日）基準です。

> ⚠ **注意**：GitHub Pages は静的公開のため、下書き・予約記事の**ファイル自体は公開リポジトリに存在し、URL を直接指定すれば見られます**。一覧や検索には出ませんが、**秘密の内容は書かないでください**。完全に隠したい下書きはリポジトリに入れず、手元で保管してください。

> ⚠ GitHub の仕様で、リポジトリに 60 日間更新がないと定期実行（毎時の自動更新）が止まります。止まった場合は **Actions** タブ → **Build posts index** → **Enable workflow** で再開できます。**Run workflow** ボタンで手動実行もできます。

---

## 6. アイコン・アイキャッチの差し替え

同じファイル名で上書きアップロードすれば差し替わります。

| 画像 | ファイル名 | 推奨サイズ | 形式 |
|---|---|---|---|
| アイコン | `assets/img/icon.svg`（または `icon.png`） | 512×512 px（正方形） | PNG/SVG |
| apple-touch-icon（iPhone のホーム画面用） | `assets/img/apple-touch-icon.png` | 180×180 px | PNG |
| アイキャッチ | `assets/img/eyecatch.svg`（または `.png` など） | 1600×400 px（4:1）※スマホでは左右が切り取られるので、大事なものは中央に | PNG/JPG/SVG/WebP |

- **形式を変える場合**（例：`icon.svg` → `icon.png`）は、`site.config.json` の `icon` / `eyecatch` のパスも書き換えてください。
- ブラウザのタブに出るアイコン（favicon）にも `icon` の画像が使われます。

---

## 7. 「このブログについて」の編集

リポジトリ直下の `about.md` を編集してください（Markdown）。
管理人名はこのページにだけ書きます（他の場所には表示されません）。

- Windows / iPhone とも：GitHub で `about.md` を開く → 右上の ✏（鉛筆）ボタン → 書き換えて **Commit changes**

---

## 8. コメント欄（giscus）の設定

記事の下に、GitHub Discussions を使ったコメント欄（[giscus](https://giscus.app/ja)）を表示できます。
**設定値が空の間は、コメント欄は表示されません。**

1. リポジトリの **Settings** → **General** → 下の方の **Features** で **Discussions** にチェックを入れる
2. 上のタブに出てきた **Discussions** を開き、左の **Categories** の鉛筆ボタン → **New category**
   - 名前：`Comments`、形式（Discussion Format）：**Announcement** にして作成
3. [GitHub App「giscus」](https://github.com/apps/giscus) を開き、**Install** → このリポジトリ（`BOM`）を選んでインストール
4. [giscus.app](https://giscus.app/ja) を開き、「設定」欄で
   - リポジトリに `hungrycyano/BOM` と入力
   - Discussion のカテゴリーで `Comments` を選ぶ
   - 下に表示されるコードの中から `data-repo`、`data-repo-id`、`data-category`、`data-category-id` の値をコピー
5. `site.config.json` の `comments` に貼り付けて保存（Commit）
   ```json
   "comments": {
     "repo": "hungrycyano/BOM",
     "repoId": "R_xxxxxxxx",
     "category": "Comments",
     "categoryId": "DIC_xxxxxxxx"
   }
   ```

- 記事ごとに別のスレッドになります（記事フォルダ名で対応づけ）。ダークモードにも自動で追従します。
- 特定の記事でコメント欄を出したくない場合は、フロントマターに `comments: false` を書きます。
- ⚠ **コメントするには、読者が GitHub アカウントでログインする必要があります**。匿名コメントはできません。

---

## 9. アクセス解析（GoatCounter）の設定

[GoatCounter](https://www.goatcounter.com/) は、Cookie を使わず個人情報を集めない軽量なアクセス解析です（個人の非営利ブログは無料）。
**サイトコードが空の間は、計測スクリプトは読み込まれません。** 手元（localhost）での確認時も計測しません。

1. [goatcounter.com](https://www.goatcounter.com/signup) で無料登録し、サイトコード（例：`bom-blog`）を決める
   → `https://bom-blog.goatcounter.com` が自分のダッシュボードになります
2. `site.config.json` の `analytics.goatcounter` にコードを書いて保存（Commit）
   ```json
   "analytics": { "goatcounter": "bom-blog" }
   ```
3. 閲覧数は GoatCounter のダッシュボードで確認できます（記事を切り替えるごとに1閲覧として記録されます）

Cookie を使わないため、Cookie 同意バナーは不要です（「このブログについて」に利用している旨を記載済み）。

---

## 10. 設定ファイル `site.config.json`

| 項目 | 内容 |
|---|---|
| `title` | ブログのタイトル |
| `subtitles` | タイトル下の小さな文字（1行ずつ配列で） |
| `description` | 検索エンジン向けの説明文 |
| `icon` / `eyecatch` | アイコン・アイキャッチ画像のパス |
| `eyecatchAlt` | アイキャッチの説明文 |
| `pageSize` | 一覧で「もっと見る」1回あたりの件数（初期値 20） |
| `comments` | giscus の設定（8章） |
| `analytics.goatcounter` | GoatCounter のサイトコード（9章） |

---

## 11. 手元（パソコン）で確認する

[Node.js](https://nodejs.org/ja)（18 以上）が必要です。

```bash
node scripts/build-index.mjs
```

下書き・予約記事も含めて確認したいとき（一覧に「下書き」「予約」バッジが付きます。**この状態の posts.json はコミットしないでください**）：

```bash
node scripts/build-index.mjs --include-drafts
```

確認用のサーバーを起動して、ブラウザで表示された URL（例：`http://localhost:3000`）を開きます。

```bash
npx serve .
```

---

## 12. ファイル構成

```
/
├─ index.html                 … ページの骨格
├─ about.md                   … 「このブログについて」
├─ site.config.json           … サイト設定
├─ assets/
│   ├─ css/style.css
│   ├─ js/app.js              … ルーティング・描画・固定ボタン・コメント・解析
│   ├─ js/search.js           … キーワード検索
│   └─ img/                   … アイコン・アイキャッチ
├─ vendor/                    … marked（Markdown 描画）、DOMPurify（安全化）
├─ posts/                     … 記事（1記事1フォルダ）
├─ posts.json                 … 記事一覧（自動生成・編集不要）
├─ search-index.json          … 検索用本文（自動生成・編集不要）
├─ scripts/build-index.mjs    … 上の2ファイルを作るスクリプト
├─ .github/workflows/build-index.yml … push 時と毎時に自動実行
└─ .nojekyll
```

### URL の形式（共有できます）

| ページ | URL |
|---|---|
| 記事 | `#/post/2026-11-01-sample-md` |
| タグ | `#/tag/ChatGPT` |
| カテゴリー | `#/category/AI` |
| 月別 | `#/month/2026-11` |
| キーワード検索 | `#/search?q=設定` |
| 一覧ページ | `#/tags` `#/categories` `#/archive` |
| このブログについて | `#/about` |

### 使用ライブラリ

- [marked](https://github.com/markedjs/marked)（MIT License）
- [DOMPurify](https://github.com/cure53/DOMPurify)（Apache-2.0 / MPL-2.0）
