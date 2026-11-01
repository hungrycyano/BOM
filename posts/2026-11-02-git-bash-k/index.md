---
title: GitBashの黒画面でコマンドを打つ緊張感
date: 2026-11-02 07:00
category: GitHub
tags: [GitBash]
type: story
summary: 変更や、追加したいファイルをローカルのパソコンで作成して、GitHubに届ける作業です。
---


## 1. 「git pull」が、GitHubにファイルを上げるときのファースト・ステップ
![gitbashの黒いコマンドラインに2列の文字、上がgit pull](img/gitbash1.png)

変更や追加を、GitHubに上げます。
先にpushしたら、いきなりテキストエディタが出てきて、あせりました。

**絶対にpushより、pullが先！　忘れてはいけません。**


## 2. 先ほどの、pullとpushのあいだに、３行が入ります。
![gitbashの黒いコマンドラインに3列の文字](img/gitbash2.png)

- git status　　　　　　：赤文字のファイルの確認 
- git add ファイル名　　：アドをします
- git commit -m "理由" ：コミットします

あとは、サイトを確認してＯＫです。