---
title: プルリクエストができて「やったー」→ git push でエラーが出て真っ青になった話
date: 2026-11-04 19:15
category: GitHub
tags: [GitHub, Git Bash, git push, エラー, 失敗談]
type: md
summary: プルリクエストができて浮かれていたら、記事を Git Bash で push したときに「fatal error in commit_refs」。真っ青になったけれど、原因は GitHub 側の一時的なエラーで、push し直すだけで直りました。
---

![プルリクエストができて喜んだあと、git push でエラーが出て真っ青になったイメージ](cover.png)

## やったー！プルリクエストができた

[プルリクエストの練習](#/post/2026-11-02-pull-request-practice)を重ねて、
[ゲーム作りの記事](#/post/2026-11-03-slow-game-pr)も、自分でプルリクエストを作ってマージできるようになりました。

紫の **Merged** を見るたびに「やったー！」と小さくガッツポーズ。
すっかり気分が良くなって、次の記事「[モザイク・タイル](#/post/2026-11-04-mosaic-tiles)」を書きました。

## いつものように Git Bash で送ったら…

手元のパソコンで記事のフォルダを作って、いつもの手順です。

```bash
git pull
git add .
git commit -m "20261104投稿mosaic.tiles"
git push
```

`git pull` も `git add` も `git commit` も順調。最後の `git push` を押したら…

```text
remote: fatal error in commit_refs
To https://github.com/hungrycyano/BOM.git
 ! [remote rejected] main -> main (failure)
error: failed to push some refs to 'https://github.com/hungrycyano/BOM.git'
```

**fatal error**（致命的なエラー）。**rejected**（拒否された）。**failed**（失敗した）。

……真っ青です。😱
「さっきまで順調だったのに、何か壊してしまった？」「ブログが消えた？」と頭の中がぐるぐる。

## Claude に聞いてみた

エラーをそのままコピーして、Claude に「どうしたらいい？」と聞きました。答えはこうでした。

- `fatal error in commit_refs` は、**GitHub のサーバー側** で保存に失敗したときのメッセージ
- **自分の操作ミスではない**（ファイル名や画像の大きさのせいでもない）
- コミットは **手元に残っている** ので消えていない
- `git add` や `git commit` はやり直さず、**数分おいて `git push` だけ** もう一度

## もう一度 push したら…あっさり成功

言われたとおり、少し待ってから `git push` だけもう一度。
今度はあっさり通って、`main -> main` の表示が出ました。ブログにもちゃんと記事が載りました。

「Claude が直してくれたの？」と聞いたら、「いいえ、何もしていません。確かめただけです」とのこと。
**GitHub の窓口が一時的に閉まっていただけ**で、時間をおいて持っていったら受け付けてもらえた、という話でした。

## 今回の教訓

| 教訓 | 内容 |
|---|---|
| まず切り分ける | エラーが出たら「自分のミス？ 相手（GitHub）のせい？」を考える。`remote:` で始まる行は GitHub 側からのメッセージ |
| 慌ててやり直さない | push が失敗しても、コミットは手元に残っている。やり直すのは push だけでいい |
| 少し待つ | サーバー側の一時的なエラーは、数分おくと直ることが多い |
| 障害情報を見る | 何度やってもだめなら <https://www.githubstatus.com/> で GitHub 自体の不調を確認 |
| 作業の前に pull | GitHub 側の自動処理でコミットが増えていることがあるので、作業前に `git pull` |

> 💡 どうしても push が通らないときは、ブランチとして送って、プルリクエストでマージする方法もあります。
> `git push origin main:ブランチ名` で送れます。

## おわりに

「やったー」から「真っ青」まで、たった数分でした。
でも、エラーの意味が分かれば怖くない。慌てて全部やり直さずに済んだのは、少しずつ Git に慣れてきた証拠かもしれません。

失敗談のネタは、まだまだ尽きなさそうです。😅
