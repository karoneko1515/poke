# 📱 Tailscale セットアップガイド

Tailscaleを使って、外出先からスマホでポケモンカードアプリにアクセスする方法です。

---

## 🎯 Tailscaleとは？

自分のデバイス同士を安全につなぐVPNサービスです。

**メリット**
- 🔒 暗号化通信で安全
- 🆓 無料で無制限
- 📍 IPアドレス固定（ブックマーク可能）
- 🔐 自分のデバイスのみアクセス可能

---

## 📋 セットアップ手順

### STEP 1: PCにTailscaleをインストール

#### macOSの場合

```bash
# Homebrewでインストール
brew install tailscale
```

または、App Storeから「Tailscale」をインストール

#### Windowsの場合

1. https://tailscale.com/download にアクセス
2. Windows版をダウンロード
3. インストーラーを実行

#### Linuxの場合

```bash
# Debian/Ubuntu
curl -fsSL https://tailscale.com/install.sh | sh
```

---

### STEP 2: PCでTailscaleを起動

#### ターミナルから起動（推奨）

```bash
sudo tailscale up
```

#### 初回ログイン

1. ブラウザが自動で開きます
2. Googleアカウント、Microsoft、GitHub等でログイン
3. 「Connect」をクリック

#### 接続確認

```bash
tailscale status
```

以下のように表示されればOK：

```
100.101.102.103  your-pc-name    macOS   -
```

---

### STEP 3: スマホにTailscaleをインストール

#### iPhone

1. App Store を開く
2. 「Tailscale」で検索
3. インストール
4. アプリを起動
5. **PCと同じアカウント**でログイン
6. VPN設定の許可を求められたら「許可」

#### Android

1. Google Play Store を開く
2. 「Tailscale」で検索
3. インストール
4. アプリを起動
5. **PCと同じアカウント**でログイン
6. VPN設定の許可を求められたら「許可」

---

### STEP 4: アプリを起動

```bash
# Tailscale版起動スクリプトを実行
./run_app_with_tailscale.py
```

または

```bash
python3 run_app_with_tailscale.py
```

以下のように表示されます：

```
✅ Tailscale接続確認OK (IP: 100.101.102.103)

📱 スマホからアクセスする方法

【アクセスURL】
  🌐 http://100.101.102.103:8000
```

---

### STEP 5: スマホからアクセス

1. **Tailscaleアプリを起動**
   - VPN接続がONになっていることを確認

2. **ブラウザを開く**
   - Safari (iPhone) または Chrome (Android)

3. **URLを入力**
   ```
   http://100.101.102.103:8000
   ```
   ※ IPアドレスは自分の環境に合わせて変更

4. **完了！** データ入力・閲覧ができます

---

## 📌 便利な設定

### ブックマークに追加

IPアドレスは固定なので、一度ブックマークに登録すれば次から簡単にアクセスできます。

### ホーム画面に追加 (iPhone)

1. Safariでアプリを開く
2. 共有ボタン（□に↑）をタップ
3. 「ホーム画面に追加」を選択
4. アプリのようにアイコンが表示される

### QRコードでアクセス

```bash
# qrcodeライブラリをインストール
pip install qrcode
```

起動スクリプトがQRコードを表示するようになります。
スマホのカメラで読み取るだけでアクセスできます！

---

## ❓ よくある質問

### Q: IPアドレスを確認する方法は？

```bash
tailscale ip -4
```

### Q: Tailscaleが起動しているか確認する方法は？

```bash
tailscale status
```

「Tailscale is stopped」と表示されたら：

```bash
sudo tailscale up
```

### Q: 接続できない場合は？

1. **PC側の確認**
   ```bash
   # Tailscaleが起動しているか
   tailscale status

   # アプリが起動しているか
   # ./run_app_with_tailscale.py を実行中か確認
   ```

2. **スマホ側の確認**
   - Tailscaleアプリを開く
   - VPN接続がONになっているか確認
   - 同じアカウントでログインしているか確認

3. **ネットワーク確認**
   - スマホのWi-Fi/モバイルデータがONか確認
   - 機内モードがOFFか確認

### Q: PCをスリープさせるとどうなる？

アクセスできなくなります。外出中に使いたい場合は：

```bash
# macOS: スリープを防止
caffeinate -i
```

または、システム環境設定 > バッテリー > 「ディスプレイがオフのときに自動でスリープさせない」にチェック

### Q: Tailscaleを終了する方法は？

```bash
sudo tailscale down
```

---

## 🔧 トラブルシューティング

### 「Tailscaleがインストールされていません」と表示される

```bash
# macOS
brew install tailscale

# または公式サイトからダウンロード
# https://tailscale.com/download
```

### 「TailscaleのIPアドレスを取得できませんでした」

```bash
# Tailscaleを起動
sudo tailscale up

# 状態確認
tailscale status
```

### スマホで「接続できません」と表示される

1. スマホのTailscaleアプリでVPN接続がONか確認
2. PCのTailscaleが起動しているか確認
3. 同じアカウントでログインしているか確認
4. IPアドレスが正しいか確認（`tailscale ip -4`）

### 画像が表示されない

- ブラウザのキャッシュをクリア
- ページを再読み込み

---

## 📊 ngrokとの比較

| 項目 | Tailscale | ngrok |
|------|-----------|-------|
| セキュリティ | ⭐️⭐️⭐️ VPN暗号化 | ⭐️⭐️ HTTPS |
| 外部公開 | されない（自分専用） | される（URL知れば誰でも） |
| URL | 固定IP | 毎回変わる（無料版） |
| 速度 | 高速（P2P） | 普通（サーバー経由） |
| 料金 | 無料 | 無料（制限あり） |
| 時間制限 | なし | 8時間（無料版） |

---

## 💡 ヒント

### 常時アクセスしたい場合

PCを常時起動しておく必要があります。おすすめの方法：

1. **macOSの場合**
   - システム環境設定 > バッテリー > スリープ設定を調整

2. **Raspberry Piを使う**
   - 消費電力が少ない（月50円程度）
   - 24時間稼働に最適

### 複数デバイスからアクセス

同じTailscaleアカウントでログインすれば、複数のスマホやタブレットからアクセスできます。

---

## 🆘 サポート

問題が解決しない場合：

- Tailscale公式ドキュメント: https://tailscale.com/kb/
- Tailscale Status: https://status.tailscale.com/

---

## 📝 チェックリスト

セットアップが完了したか確認：

- [ ] PCにTailscaleをインストールした
- [ ] `sudo tailscale up` でログインした
- [ ] スマホにTailscaleアプリをインストールした
- [ ] スマホで同じアカウントにログインした
- [ ] `./run_app_with_tailscale.py` でアプリを起動した
- [ ] スマホのブラウザでアクセスできた
- [ ] ブックマークに追加した

すべてチェックできれば完了です！🎉
