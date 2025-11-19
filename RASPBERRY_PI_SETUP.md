# 🍓 Raspberry Pi サーバー構築ガイド

Raspberry PiでポケモンカードアプリをTailscale経由で24時間稼働させる方法です。

---

## 📋 必要なもの

### ハードウェア
- **Raspberry Pi 4** (2GB以上推奨) または **Raspberry Pi 5**
- **microSDカード** (32GB以上推奨)
- **電源アダプター** (公式推奨品)
- **LANケーブル** (Wi-Fiでも可)

### ソフトウェア
- **Raspberry Pi Imager** (OSインストール用)
- **ターミナル** (SSH接続用)

---

## 🚀 セットアップ手順

## STEP 1: Raspberry Pi OSのインストール

### 1-1. Raspberry Pi Imagerをダウンロード

Mac:
```bash
brew install --cask raspberry-pi-imager
```

または https://www.raspberrypi.com/software/ からダウンロード

### 1-2. OSを書き込み

1. **Raspberry Pi Imager** を起動
2. 「OSを選ぶ」→「Raspberry Pi OS (64-bit)」を選択
   - Lite版（デスクトップなし）でOK
3. 「ストレージを選ぶ」→ microSDカードを選択
4. **⚙️ 設定ボタン**（歯車アイコン）をクリック：

   ```
   ☑️ ホスト名を設定: raspberrypi
   ☑️ SSHを有効化: パスワード認証を使う
   ☑️ ユーザー名とパスワードを設定:
      ユーザー名: pi
      パスワード: (お好みのパスワード)
   ☑️ Wi-Fiを設定: (自宅のWi-Fi情報)
   ☑️ ロケール設定:
      タイムゾーン: Asia/Tokyo
      キーボードレイアウト: jp
   ```

5. 「書き込む」をクリック

### 1-3. Raspberry Piを起動

1. microSDカードをRaspberry Piに挿入
2. LANケーブルを接続（またはWi-Fi設定済みならそのまま）
3. 電源を接続
4. 1〜2分待つ（初回起動は時間がかかる）

---

## STEP 2: SSH接続

### 2-1. IPアドレスを確認

ルーターの管理画面、または：

```bash
# Macから検索
ping raspberrypi.local
```

### 2-2. SSH接続

```bash
ssh pi@raspberrypi.local
```

または

```bash
ssh pi@192.168.x.x  # IPアドレスを指定
```

パスワードを入力してログイン。

---

## STEP 3: Raspberry Piの初期設定

### 3-1. システムを更新

```bash
sudo apt update && sudo apt upgrade -y
```

### 3-2. 必要なパッケージをインストール

```bash
sudo apt install -y python3-pip python3-venv git
```

### 3-3. 日本語フォントをインストール（グラフ用）

```bash
sudo apt install -y fonts-ipafont fonts-ipaexfont
```

---

## STEP 4: Tailscaleをインストール

### 4-1. インストール

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### 4-2. 起動してログイン

```bash
sudo tailscale up
```

表示されるURLをMacのブラウザで開いてログイン。

**重要**: スマホと同じアカウントでログインしてください。

### 4-3. 接続確認

```bash
tailscale ip -4
```

IPアドレス（例: `100.101.102.103`）が表示されればOK。

---

## STEP 5: アプリをRaspberry Piにコピー

### 方法A: GitHubから（推奨）

Macで変更をプッシュ済みなら：

```bash
# Raspberry Piで実行
cd ~
git clone https://github.com/karoneko1515/poke.git
cd poke
```

### 方法B: scpでコピー

Macから：

```bash
# pokeフォルダをRaspberry Piにコピー
scp -r /path/to/poke pi@raspberrypi.local:~/
```

### 5-1. 仮想環境を作成

```bash
cd ~/poke
python3 -m venv venv
source venv/bin/activate
```

### 5-2. 依存パッケージをインストール

```bash
pip install eel matplotlib pillow
```

### 5-3. データベースをコピー（既存データがある場合）

Macから：

```bash
scp /path/to/poke/pokemon_cards.db pi@raspberrypi.local:~/poke/
```

画像もコピー：

```bash
scp -r /path/to/poke/web/static/images pi@raspberrypi.local:~/poke/web/static/
```

---

## STEP 6: 動作確認

### 6-1. アプリを起動

```bash
cd ~/poke
source venv/bin/activate
python main.py
```

### 6-2. スマホからアクセス

1. スマホでTailscaleアプリを起動（VPN接続ON）
2. ブラウザで `http://[TailscaleのIP]:8000` にアクセス

例: `http://100.101.102.103:8000`

動作すれば成功！`Ctrl+C` で一旦停止。

---

## STEP 7: 自動起動設定

Raspberry Pi起動時に自動でアプリが立ち上がるようにします。

### 7-1. systemdサービスファイルを作成

```bash
sudo nano /etc/systemd/system/pokemon-cards.service
```

以下を貼り付け（`pi`は自分のユーザー名に変更）：

```ini
[Unit]
Description=Pokemon Cards Asset Manager
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/poke
ExecStart=/home/pi/poke/venv/bin/python /home/pi/poke/main.py
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
```

`Ctrl+O` で保存、`Ctrl+X` で終了。

### 7-2. サービスを有効化

```bash
# サービスを登録
sudo systemctl daemon-reload

# 自動起動を有効化
sudo systemctl enable pokemon-cards

# サービスを開始
sudo systemctl start pokemon-cards
```

### 7-3. 状態確認

```bash
sudo systemctl status pokemon-cards
```

「active (running)」と表示されればOK。

### 7-4. ログを確認

```bash
sudo journalctl -u pokemon-cards -f
```

---

## STEP 8: スマホにTailscaleをインストール

### iPhone
1. App Store で「**Tailscale**」を検索
2. インストール
3. **Raspberry Piと同じアカウント**でログイン
4. VPN設定を「許可」

### Android
1. Google Play で「**Tailscale**」を検索
2. インストール
3. **Raspberry Piと同じアカウント**でログイン

---

## STEP 9: 完了！

### スマホからアクセス

1. Tailscaleアプリを開いてVPN接続ON
2. ブラウザで以下にアクセス：
   ```
   http://[TailscaleのIP]:8000
   ```
   例: `http://100.101.102.103:8000`

### ブックマークに追加

IPアドレスは固定なので、ブックマークしておくと便利！

---

## 📌 便利なコマンド

### サービス管理

```bash
# 状態確認
sudo systemctl status pokemon-cards

# 再起動
sudo systemctl restart pokemon-cards

# 停止
sudo systemctl stop pokemon-cards

# ログ確認
sudo journalctl -u pokemon-cards -f
```

### TailscaleのIP確認

```bash
tailscale ip -4
```

### Raspberry Piの再起動

```bash
sudo reboot
```

### Raspberry Piのシャットダウン

```bash
sudo shutdown -h now
```

---

## ❓ トラブルシューティング

### アプリが起動しない

```bash
# ログを確認
sudo journalctl -u pokemon-cards -n 50

# 手動で起動してエラーを確認
cd ~/poke
source venv/bin/activate
python main.py
```

### Tailscaleに接続できない

```bash
# 状態確認
tailscale status

# 再接続
sudo tailscale down
sudo tailscale up
```

### スマホからアクセスできない

1. スマホのTailscaleがVPN接続ONか確認
2. 同じアカウントでログインしているか確認
3. IPアドレスが正しいか確認: `tailscale ip -4`
4. アプリが起動しているか確認: `sudo systemctl status pokemon-cards`

### 画像が表示されない

画像ファイルがコピーされているか確認：

```bash
ls ~/poke/web/static/images/
```

### データベースがない

```bash
ls ~/poke/pokemon_cards.db
```

なければMacからコピー：

```bash
# Macで実行
scp /path/to/poke/pokemon_cards.db pi@raspberrypi.local:~/poke/
```

---

## 💡 ヒント

### 固定IPアドレスにする（ローカル）

Tailscaleを使うならTailscaleのIPは固定なので不要ですが、ローカルIPも固定したい場合：

```bash
sudo nano /etc/dhcpcd.conf
```

末尾に追加：

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

### バックアップ

定期的にデータベースをバックアップ：

```bash
# Raspberry Piで実行
cp ~/poke/pokemon_cards.db ~/poke/pokemon_cards_backup_$(date +%Y%m%d).db
```

Macにコピー：

```bash
# Macで実行
scp pi@raspberrypi.local:~/poke/pokemon_cards.db ~/Desktop/
```

### 電源断対策

突然の電源断でSDカードが壊れることがあります。UPS（無停電電源装置）の導入を検討してください。

---

## 📊 コスト

| 項目 | 費用 |
|------|------|
| Raspberry Pi 4 (4GB) | 約8,000円 |
| microSDカード (32GB) | 約1,000円 |
| 電源アダプター | 約1,500円 |
| **初期費用合計** | **約10,500円** |
| 電気代（月） | 約50円 |

---

## 🎉 完成！

これで24時間いつでもスマホからアクセスできます：

- ✅ Raspberry Piを常時起動
- ✅ 電気代は月50円程度
- ✅ Tailscaleで暗号化された安全な接続
- ✅ IPアドレス固定でブックマーク可能
- ✅ 自動起動で再起動後も自動復帰

お疲れ様でした！🍓
