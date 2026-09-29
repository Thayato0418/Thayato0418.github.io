# h_Takara profile

GitHub Pagesで公開するプロフィール。記事一覧はCloudflare WorkersがはてなRSSから取得します。

## セットアップ

```sh
npm ci
npm test
npx wrangler login --scopes account:read user:read workers:write workers_scripts:write
npm run check:feed
npm run deploy:feed
```

Cloudflareの **Workers Free** プランを使用してください。有料サービス、KV、データベース、Cronは不要です。
初回はブラウザでCloudflareへのログインとWranglerの認証を行います。
公開後に表示される `https://takara-hatena-feed.<subdomain>.workers.dev` に `/api/articles` を付け、`feed-config.js` の `window.HATENA_FEED_API` に設定してください。空の場合は保存済みJSONを表示します。
GitHub Pages用ファイルも通常の方法で公開すると本番のページに反映されます。

## 更新とフォールバック

- APIは取得先を `https://h-takara.hatenablog.com/rss` に固定。入力URLを代理取得する仕組みではありません。
- 最初のアクセスでRSSを取得し、Cloudflare Cache APIに保存。取得から120秒以内はキャッシュを返します。キャッシュはデータセンターごとで、永続ストレージではありません。
- 閲覧中のページは60秒ごとにAPIを確認。非表示タブでは停止します。
- RSS更新の遅延に加え、最大約120秒のキャッシュと約60秒の再確認間隔があるため、投稿直後の反映は保証しません。
- RSSが取得できない場合は、APIが24時間以内のキャッシュを返します。それもなければ503を返します。
- ブラウザは取得失敗時に表示中またはlocalStorage保存済みの記事を維持し、初回は `data/hatena-articles.json` にフォールバックします。保存済み表示は最新であるとは表示しません。
- RSS取得時刻と状態を記事一覧の下に表示します。これは記事の投稿日時や直近のブラウザ通信時刻とは別です。
- 記事リンクのホスト、画像URLのHTTPS、レスポンス形式を検証します。RSSは1MiB・8秒、クライアントは12秒に制限しています。
- CORS許可先は `wrangler.jsonc` の `ALLOWED_ORIGINS`。標準設定はGitHub Pages本番とローカルプレビューのポート8765です。CORSは認証ではなく、APIは公開情報を返す公開エンドポイントです。

## ローカル確認

```sh
npm run dev:feed
python3 -m http.server 8765 --bind 127.0.0.1
```

WorkerのローカルURLに `/api/articles` を付けて一時的に `feed-config.js` へ設定してください。確認後は公開URLに戻します。`npm test` ではキャッシュ期限、RSS失敗、CORS、危険なURL、保存記事への切り替え、非表示タブの停止を検証します。

保存済みJSONを更新する場合:

```sh
npm run update:hatena
```

## 無料枠

Workers Freeの上限はアカウント全体で1日100,000リクエスト、1回あたりCPU時間10msです。APIのキャッシュ命中でもWorkerの呼び出し回数は数えられます。利用中の他のWorkerと枠を共有します。上限到達時は取得失敗時の代替表示を使います。有料プランへの変更は自動化していません。

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
