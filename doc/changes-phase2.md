# Phase 2 变更文档

> 日時: 2026-06-10
> プロジェクト: 东方幻想麻雀 (Touhou Gensou Mahjong)

---

## 1. 庄家随机

**変更前**: 常にプレイヤー1（東家）が庄家だった。

**変更後**: ゲーム開始時にランダムに庄家を決定。
`createInitialState` が `dealerWind` パラメータを受け取り、未指定時はランダム選択。
`isDealer` フラグが庄家プレイヤーにのみ設定される。

**変更ファイル**: `src/game/gameEngine.ts`

---

## 2. 自風表示

各プレイヤーの得点の横に自風（東/南/西/北）を表示。
OpponentSection と PlayerSection 両方に追加。

**変更ファイル**: `src/components/GameTable.tsx`, `src/styles/global.css`

---

## 3. ゲーム長選択

牌局画面上部にゲーム長選択ドロップダウンを追加:
- 东风战 (東風戦) — 東場のみ
- 东南战 (東南戦) — 東＋南（デフォルト）
- 东西战 (東西戦) — 東＋西
- 东北战 (東北戦) — 東＋北

現在はUIのみ。終了条件の連動は未実装。

**変更ファイル**: `src/App.tsx`, `src/styles/global.css`, `src/game/types.ts`

---

## 4. 组队模式ボタン有効化

タイトル画面の「组队模式」ボタンを有効化。
現在は单人模式と同じキャラ選択画面を使用。
チーム専用の選択UI・5人リレー対戦は未実装。

**変更ファイル**: `src/components/StartPage.tsx`, `src/App.tsx`

---

## 5. 食べバグ修正

**原因**: `useGame.ts` の `humanAction` が `_tiles` パラメータを受け取っていたが、
`ctrl.humanAction(action)` を呼び出す際に `_tiles` を渡していなかった。
Controller の `case 'chi'` で `tiles` が `undefined` となり、
常に `chiOptions[0][0]`（最初の組み合わせ）が選択されていた。

**修正**: `ctrl.humanAction(action, _tiles)` に変更。

**変更ファイル**: `src/hooks/useGame.ts`

---

## 未実装 (TODO)

- 组队模式的队伍选择UI（先选队伍再选角色）
- 组队赛5人接力流程
- 游戏长度联动结束条件
- 组队战快速开始
