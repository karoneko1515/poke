# 📱 スマホから外出先でアクセスする方法

## 🚀 方法1: ngrok (推奨・簡単)

### セットアップ (初回のみ)

#### 1. ngrokのインストール

```bash
# macOSの場合
brew install ngrok/ngrok/ngrok

# Windowsの場合
# https://ngrok.com/download からダウンロード
```

#### 2. ngrokアカウント作成

1. https://dashboard.ngrok.com/signup にアクセス
2. 無料アカウントを作成
3. 認証トークンを取得

#### 3. ngrok認証設定

```bash
ngrok config add-authtoken <ダッシュボードに表示されたトークン>
```

### 使い方

#### 起動

```bash
# ngrok対応版を起動
./run_app_with_ngrok.py
```

または

```bash
python3 run_app_with_ngrok.py
```

#### スマホからアクセス

1. ターミナルに表示された **外部アクセスURL** をコピー
   ```
   例: https://abc123.ngrok-free.app
   ```

2. スマホのブラウザで開く
   - Safari (iPhone)
   - Chrome (Android)

3. データ入力・閲覧が可能！

### 注意点

⚠️ **このPCの電源を入れたままにする必要があります**

⚠️ **無料版の制限**
- URLが起動ごとに変わる
- 8時間でセッション終了
- 帯域制限あり

💰 **有料版 (約$8/月) のメリット**
- 固定URL (例: https://my-pokemon-cards.ngrok.io)
- 無制限セッション
- カスタムドメイン対応

---

## 🔒 方法2: Tailscale (よりセキュア)

### セットアップ

#### 1. Tailscaleインストール

```bash
# macOS
brew install tailscale

# またはhttps://tailscale.com/download からダウンロード
```

#### 2. Tailscale起動

```bash
sudo tailscale up
```

ブラウザが開くのでログイン（Google/Microsoft等）

#### 3. スマホにもTailscaleインストール

- iPhone: App Store
- Android: Google Play

同じアカウントでログイン

### 使い方

#### 1. PC側の準備

```bash
# 通常の起動スクリプトを使用
./run_app.py
```

#### 2. TailscaleでIPアドレスを確認

```bash
tailscale ip -4
```

例: `100.101.102.103`

#### 3. スマホからアクセス

TailscaleアプリでVPN接続後、ブラウザで:

```
http://100.101.102.103:8000
```

### メリット

✅ セキュアな暗号化VPN
✅ URL固定（IPアドレスが変わらない）
✅ 無料で無制限
✅ 外部に公開されない（自分のデバイスのみ）

---

## ☁️ 方法3: VPS/クラウドホスティング (常時稼働)

PCを起動しておく必要がない方法です。

### 選択肢

1. **PythonAnywhere** (月$5〜)
   - Python専用、簡単
   - https://www.pythonanywhere.com

2. **Heroku** (月$7〜)
   - git pushでデプロイ
   - https://www.heroku.com

3. **Railway** (月$5〜)
   - モダンなUI
   - https://railway.app

### 必要な修正

- SQLiteからPostgreSQLに変更
- 画像をクラウドストレージへ (S3等)
- 環境変数設定

---

## 📊 比較表

| 方法 | 費用 | 難易度 | PC常時起動 | セキュリティ | 推奨用途 |
|------|------|--------|------------|--------------|----------|
| **ngrok** | 無料〜$8/月 | ⭐️ 簡単 | 必要 | 中 | たまに外出先で使う |
| **Tailscale** | 無料 | ⭐️⭐️ 普通 | 必要 | 高 | 頻繁に外出先で使う |
| **VPS** | $5〜/月 | ⭐️⭐️⭐️ 難しい | 不要 | 高 | 常時アクセスしたい |

---

## 🆘 トラブルシューティング

### ngrokでURLが取得できない

```bash
# ngrok管理画面を手動で開く
open http://localhost:4040
```

### Tailscaleで接続できない

```bash
# 接続状態確認
tailscale status

# 再起動
sudo tailscale down
sudo tailscale up
```

### スマホで画像が表示されない

- ブラウザのキャッシュをクリア
- PCとスマホが同じネットワーク時刻か確認

---

## 💡 おすすめ設定

### スマホでの使いやすさ向上

1. **ホーム画面に追加** (iPhone)
   - Safariでアクセス
   - 共有ボタン → ホーム画面に追加

2. **ブックマーク保存** (Android)
   - Chromeでアクセス
   - ⭐️ボタンでブックマーク

3. **QRコード生成**

```bash
# qrcodeライブラリをインストール
pip install qrcode

# run_app_with_ngrok.pyが自動でQRコード表示
```

---

## 🔐 セキュリティ注意事項

### ngrok使用時

⚠️ **公開URLは誰でもアクセス可能**
- 推測されにくいURLですが、完全には秘密ではない
- 基本認証の追加を検討:

```python
# main.pyに追加 (簡易的な例)
from functools import wraps
from flask import request, Response

def check_auth(username, password):
    return username == 'admin' and password == 'your-password'

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return Response('Login required', 401,
                          {'WWW-Authenticate': 'Basic realm="Login Required"'})
        return f(*args, **kwargs)
    return decorated
```

### Tailscale使用時

✅ **VPN暗号化で安全**
- 自分のデバイスのみアクセス可能
- 外部に公開されない

---

## 📞 サポート

問題が解決しない場合:
1. ngrok公式ドキュメント: https://ngrok.com/docs
2. Tailscale公式ドキュメント: https://tailscale.com/kb/
