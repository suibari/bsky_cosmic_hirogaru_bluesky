# 超ひろがるBluesky!!

Blueskyユーザーの人間関係を「宇宙」として可視化するWebアプリ。

## スクリーンショット

![コズミックモード](docs/screenshot_cosmic.png)

## 機能

### 2つの表示モード

| モード | 背景 | エッジ | レイアウト |
|--------|------|--------|------------|
| 🌌 コズミック | 黒 + 星屑 | あり（スコアに応じた色・太さ） | ForceAtlas2（物理シミュレーション） |
| 🔵 ひろがる | 水色グラデーション | なし | スコアに基づく静的放射状配置 |

モード切替時は800msのアニメーションでノードが滑らかに移動する。

### グラフノード
- 中心ノード（検索対象ユーザー）: サイズ固定・常に中央
- 周辺ノード: エンゲージメントスコアに比例したサイズ（8〜30px）
- アバター画像を円形クリッピングして表示
- ホバーでツールチップ表示（displayName・handle・スコア）

### エンゲージメントスコア計算

`src/lib/graph/fetchGraphData.ts` の先頭で定数宣言:

```typescript
const WEIGHTS = { like: 1, repost: 5, reply: 10, quote: 10, mention: 10, follow: 10 }
```

スコア = Σ(アクション数 × 重み)。方向は「自分→相手」「相手→自分」「両方」の3種類で管理。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フレームワーク | SvelteKit 2 (SSR無効、CSR専用) |
| UIスタイル | Tailwind CSS v4 |
| グラフ描画 | Sigma.js v3 |
| グラフデータ | graphology |
| レイアウト | graphology-layout-forceatlas2 (WebWorker) |
| ノード画像 | @sigma/node-image |
| 言語 | TypeScript (strict) |
| デプロイ想定 | Cloudflare Pages |

## ファイル構成

```
src/
├── routes/
│   ├── +page.svelte                          # ハンドル入力フォーム（トップページ）
│   ├── universe/
│   │   └── [handle]/
│   │       ├── +page.ts                      # SSR無効化 (ssr: false)
│   │       └── +page.svelte                  # メイン宇宙ビュー
│   └── api/proxy/avatar/
│       └── +server.ts                        # アバター画像プロキシ（CORS回避）
└── lib/
    ├── types.ts                              # 共通型定義
    ├── graph/
    │   ├── atUriUtils.ts                     # at-URI からDIDを抽出するユーティリティ
    │   ├── fetchGraphData.ts                 # API取得・スコア集計（メイン）
    │   ├── cosmicLayout.ts                   # ForceAtlas2 WebWorker ラッパー
    │   └── hirogaruLayout.ts                 # 静的放射状配置計算
    └── sigma/
        ├── renderer.ts                       # Sigma.js 初期化・SigmaController クラス
        └── starfield.ts                      # 星屑Canvas描画
```

## データ取得フロー

```
① resolveHandle       → DID取得
② getProfile(DID)     → 自分のプロフィール
③ 並列取得:
   - getActorLikes     → いいねした投稿の著者DID (AppView: app.bsky.feed.getActorLikes)
   - getActorFollows   → フォロー中のDID (AppView: app.bsky.graph.getFollows)
   - getActorReposts   → リポストした投稿の著者DID (AppView: app.bsky.feed.getAuthorFeed)
   - getBacklinks      → 自分がターゲットのリンク (Constellation API)
④ スコア集計・マージ
⑤ getProfiles(上位100件) → 周辺ノードのプロフィール解決（25件ずつ4並列）
```

### 使用API

| API | エンドポイント | 認証 |
|-----|---------------|------|
| Bluesky AppView | `https://public.api.bsky.app/xrpc/` | 不要 |
| Constellation | `https://constellation.microcosm.blue/xrpc/` | 不要（User-Agent必須） |

> **注意**: `com.atproto.repo.listRecords` は PDS の機能のため `public.api.bsky.app`（AppView）では501になる。AppViewが実装している各専用エンドポイント (`getActorLikes` 等) を使うこと。

> **Constellation**: リクエストヘッダーに `User-Agent: cho-hirogaru-bluesky/suibari-cha.bsky.social` が必須。`subject` パラメータでDIDを指定する。

## 開発

```bash
npm install
npm run dev        # 開発サーバー起動 (http://localhost:5173)
npm run check      # 型チェック
npm run build      # 本番ビルド
npm run preview    # 本番ビルドのプレビュー
```

## スコア調整

`src/lib/graph/fetchGraphData.ts` の定数を変更する:

```typescript
const WEIGHTS = {
  like:    1,
  repost:  5,
  reply:   10,
  quote:   10,
  mention: 10,
  follow:  10
} as const
```

取得件数の上限は同ファイルの `PAGE_LIMIT`（1リクエストあたり）と `MAX_PAGES`（ページ数上限）で調整できる。

## 既知の挙動・注意点

- **コズミックモード起動時**: ForceAtlas2レイアウトが3秒間実行される。収束するまでノードが動く
- **上位100件のみ表示**: スコア上位100ユーザーのみグラフに表示される
- **アバター画像**: CORS回避のため `/api/proxy/avatar?url=...` 経由で取得
- **プロフィール非公開ユーザー**: `getActorLikes` 等がエラーになる場合は静かに無視される
- **`ssr: false`**: `/universe/[handle]` はCSR専用。Sigma.jsがDOM必須のため

## 将来の拡張候補

- フィルタリングUI（「フォローのみ表示」「方向フィルタ」等）
- ノードクリックでプロフィールポップアップ
- ページネーション対応（現在は各APIを最大3ページまで取得）
- Cloudflare Pages へのデプロイ設定 (`adapter-cloudflare` への切り替え)
