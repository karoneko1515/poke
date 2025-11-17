#!/usr/bin/env python3
"""
ポケモンカード資産管理アプリ - ngrok対応起動スクリプト

外出先からスマホでアクセスできるようにngrokを使ってトンネル接続します。
"""

import os
import sys
import subprocess
import time
import json
import urllib.request

def main():
    # スクリプトのディレクトリを取得
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    print("=" * 60)
    print("🎴 ポケモンカード資産管理アプリ (ngrok版)")
    print("=" * 60)
    print("スマホから外出先でもアクセスできます！")
    print()

    # 仮想環境の確認
    venv_python = os.path.join(script_dir, 'venv', 'bin', 'python')
    if not os.path.exists(venv_python):
        print("❌ 仮想環境が見つかりません。")
        print("以下のコマンドを実行してセットアップしてください：")
        print("python3 -m venv venv")
        print("source venv/bin/activate")
        print("pip install eel matplotlib pillow")
        input("Enterキーを押して終了...")
        return

    # ngrokの確認
    ngrok_path = subprocess.run(['which', 'ngrok'],
                                 capture_output=True,
                                 text=True).stdout.strip()

    if not ngrok_path:
        print("❌ ngrokがインストールされていません。")
        print()
        print("インストール方法:")
        print("1. Homebrewでインストール:")
        print("   brew install ngrok/ngrok/ngrok")
        print()
        print("2. または公式サイトからダウンロード:")
        print("   https://ngrok.com/download")
        print()
        print("3. アカウント作成後、認証トークンを設定:")
        print("   ngrok config add-authtoken <your-token>")
        input("\nEnterキーを押して終了...")
        return

    processes = []
    ngrok_url = None

    try:
        # 1. Pythonアプリケーションを起動
        print("🚀 アプリケーションを起動しています...")
        app_process = subprocess.Popen(
            [venv_python, 'main.py'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        processes.append(app_process)
        time.sleep(3)  # アプリの起動を待つ
        print("✅ アプリケーション起動完了")
        print()

        # 2. ngrokを起動
        print("🌐 ngrokトンネルを開いています...")
        ngrok_process = subprocess.Popen(
            ['ngrok', 'http', '8000', '--log', 'stdout'],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        processes.append(ngrok_process)
        time.sleep(4)  # ngrokの起動を待つ

        # 3. ngrok APIから公開URLを取得
        try:
            with urllib.request.urlopen('http://localhost:4040/api/tunnels') as response:
                data = json.loads(response.read().decode())
                tunnels = data.get('tunnels', [])
                if tunnels:
                    ngrok_url = tunnels[0]['public_url']
                    print("✅ ngrokトンネル確立完了")
                    print()
        except Exception as e:
            print(f"⚠️  ngrok URL取得失敗: {e}")
            print("手動で http://localhost:4040 にアクセスしてURLを確認してください")
            print()

        # 4. アクセス情報を表示
        print("=" * 60)
        print("📱 スマホからアクセスする方法")
        print("=" * 60)

        if ngrok_url:
            print(f"\n🌍 外部アクセスURL:")
            print(f"   {ngrok_url}")
            print()
            print("📋 このURLをスマホのブラウザで開いてください")
            print("   (URLはこのセッションでのみ有効です)")
        else:
            print("\n🔍 ngrok管理画面:")
            print("   http://localhost:4040")
            print("   → ここで公開URLを確認できます")

        print()
        print("💻 ローカルアクセスURL:")
        print("   http://localhost:8000")
        print()
        print("=" * 60)
        print()
        print("⚠️  注意事項:")
        print("  • このPCの電源を入れたままにしてください")
        print("  • 無料版は8時間でセッションが切れます")
        print("  • URLは起動ごとに変わります（有料版で固定可能）")
        print()
        print("🔴 終了するには Ctrl+C を押してください")
        print("=" * 60)
        print()

        # QRコード生成の提案
        if ngrok_url:
            try:
                import qrcode
                qr = qrcode.QRCode()
                qr.add_data(ngrok_url)
                qr.make()
                print("📱 QRコード:")
                qr.print_ascii(invert=True)
                print()
            except ImportError:
                print("💡 Tip: qrcodeをインストールするとQRコードが表示されます")
                print("   pip install qrcode")
                print()

        # プロセスの終了を待つ
        app_process.wait()

    except KeyboardInterrupt:
        print()
        print("=" * 60)
        print("🛑 アプリケーションを終了しています...")
        print("=" * 60)
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
    finally:
        # 全プロセスを終了
        for process in processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except:
                try:
                    process.kill()
                except:
                    pass
        print("✅ 終了しました")

if __name__ == "__main__":
    main()
