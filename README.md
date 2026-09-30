# Swipee

サビだけ聴いて曲を発見(スワイプでいいね/スキップ) → ♥でライブラリ → プレイリスト生成(Spotifyに作成) → 友達の再生中を見る。日本語・英語・韓国語・中国語・スペイン語に対応。

## 起動
```bash
python3 server.py                 # Spotify連携なしのデモモード
SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy python3 server.py   # Spotify連携あり
```
http://127.0.0.1:8000 を開く。Python 3.9+ 標準ライブラリのみ。

## Spotify連携の設定
1. https://developer.spotify.com/dashboard でアプリ作成
2. Redirect URI に `http://127.0.0.1:8000/auth/callback` を登録
3. Development modeでは「User Management」に友達のSpotifyアカウントを登録(最大25人)

## 仕組み
- **サビ発見**: Deezer公開APIの30秒プレビュー(曲の見どころ=サビ付近)をスワイプ式で再生。♥するほど、そのアーティストの類似曲がフィードに混ざる。
- **プレイリスト**: ♥した曲を選択 → ISRCでSpotify曲と照合 → プライベートプレイリストを作成。「似た曲も追加」で30曲まで拡張。
- **友達**: 招待コードを交換して相互フォロー。Spotify連携ユーザーは15秒ごとに再生中を取得して共有、未連携でも発見中の曲が共有される。共有はOFFにできる。

## 制限
- SpotifyにはフレンドアクティビティのAPIがないため、友達機能はこのアプリ内のフレンドグラフ+各自の再生中ポーリングで実現。
- Spotifyの30秒プレビュー/音声解析APIは新規アプリでは使えないため、サビ区間はDeezerのプレビューを使用(厳密なサビ検出ではない)。
- Apple Music対応にはApple Developer Program(有料)のMusicKit鍵が必要。`make_playlist`/`poller` と同じ形で追加可能。
- 現状は個人〜友人規模向け(単一プロセス)。データはDATABASE_URL設定時はPostgres、無ければJSONファイルに保存。

## スマホで使う(PWA)
PWAのインストール・Service Workerは **HTTPS必須**(localhostのみ例外)。スマホから使うには公開URLが必要。
- iPhone: Safariで開く → 共有 → 「ホーム画面に追加」
- Android: Chromeで開く → 「アプリをインストール」
- ロック画面/イヤホンの操作(次の曲・再生停止)に対応。オフライン時は画面枠のみ表示(曲取得にはネット必要)。

### 手元で試すだけ(URLはそのつど変わる・不安定)
```bash
python3 server.py                       # 別ターミナルで
cloudflared tunnel --url http://127.0.0.1:8000   # → https://xxxx.trycloudflare.com が発行される
```
```bash
SPOTIFY_REDIRECT_URI=https://xxxx.trycloudflare.com/auth/callback SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... python3 server.py
```
無料のクイックトンネルは接続が切れることがあり、切れるたびにURLが変わる。友達と継続的に使うなら下のデプロイがおすすめ。

### 常用する(URL固定・Renderへのデプロイ)
1. このリポジトリをGitHubにpush
2. [Render](https://dashboard.render.com) にサインアップ(クレジットカード不要)
3. 「New +」→「Blueprint」→ このリポジトリを選択(`render.yaml`を自動検出し、Webサービス+無料Postgresを作成)
4. デプロイ後、Renderダッシュボードで環境変数 `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REDIRECT_URI`(`https://<割り当てられたURL>/auth/callback`)を設定
5. Spotify Developer DashboardのRedirect URIも同じ値に更新(**この1回だけでよい。以後URLは変わらない**)

**データ永続化について**: `DATABASE_URL`(Renderが自動接続する無料Postgres)があれば友達・いいね・プレイリストはそちらに保存され、サーバーがスリープしても消えない。ただしRenderの無料Postgresは**作成から30日で失効**するため、期限が来たら新しいデータベースを作り直してRenderの環境変数を張り替える必要がある(データは移行されない)。`DATABASE_URL`が無い場合は従来通り`data.json`に保存するが、Render無料プランはファイルシステムが揮発性なので、15分アクセスがないとスリープ時にデータが消える。
