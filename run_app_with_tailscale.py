#!/usr/bin/env python3
"""
ポケモンカード資産管理アプリ - Tailscale対応起動スクリプト

Tailscale VPN経由でスマホから安全にアクセスできます。
"""

import os
import sys
import subprocess
import time

def get_tailscale_ip():
    """TailscaleのIPアドレスを取得"""
    try:
        result = subprocess.run(
            ['tailscale', 'ip', '-4'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None

def get_tailscale_status():
    """Tailscaleの状態を取得"""
    try:
        result = subprocess.run(
            ['tailscale', 'status'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0, result.stdout
    except FileNotFoundError:
        return False, "Tailscaleがインストールされていません"
    except Exception as e:
        return False, str(e)

def main():
    # スクリプトのディレクトリを取得
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    print("=" * 60)
    print("🎴 ポケモンカード資産管理アプリ (Tailscale版)")
    print("=" * 60)
    print("Tailscale VPN経由でスマホから安全にアクセスできます！")
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

    # Tailscaleの状態確認
    print("🔍 Tailscaleの状態を確認中...")
    is_running, status_output = get_tailscale_status()

    if not is_running:
        print()
        print("❌ Tailscaleが起動していません。")
        print()
        print("=" * 60)
        print("📋 Tailscaleのセットアップ手順")
        print("=" * 60)
        print()
        print("【1. インストール】")
        print("  macOS:")
        print("    brew install tailscale")
        print()
        print("  Windows:")
        print("    https://tailscale.com/download からダウンロード")
        print()
        print("【2. Tailscaleを起動】")
        print("  sudo tailscale up")
        print()
        print("  → ブラウザが開くのでGoogleアカウント等でログイン")
        print()
        print("【3. スマホにもTailscaleをインストール】")
        print("  iPhone: App Store で「Tailscale」を検索")
        print("  Android: Google Play で「Tailscale」を検索")
        print()
        print("  → 同じアカウントでログイン")
        print()
        print("【4. 再度このスクリプトを実行】")
        print("  ./run_app_with_tailscale.py")
        print()
        input("Enterキーを押して終了...")
        return

    # TailscaleのIPアドレスを取得
    tailscale_ip = get_tailscale_ip()

    if not tailscale_ip:
        print("❌ TailscaleのIPアドレスを取得できませんでした。")
        print("以下のコマンドで確認してください：")
        print("  tailscale ip -4")
        input("Enterキーを押して終了...")
        return

    print(f"✅ Tailscale接続確認OK (IP: {tailscale_ip})")
    print()

    try:
        # Pythonアプリケーションを起動
        print("🚀 アプリケーションを起動しています...")
        process = subprocess.Popen([venv_python, 'main.py'])

        time.sleep(3)  # アプリの起動を待つ

        print("✅ アプリケーション起動完了！")
        print()

        # アクセス情報を表示
        print("=" * 60)
        print("📱 スマホからアクセスする方法")
        print("=" * 60)
        print()
        print("【スマホ側の準備】")
        print("  1. Tailscaleアプリを起動")
        print("  2. VPN接続をON（同じアカウントでログイン）")
        print()
        print("【アクセスURL】")
        print(f"  🌐 http://{tailscale_ip}:8000")
        print()
        print("  ↑ このURLをスマホのブラウザで開いてください")
        print()
        print("=" * 60)
        print()
        print("💡 Tips:")
        print(f"  • このURLはブックマーク可能（IPは固定）")
        print(f"  • Tailscaleは暗号化されているので安全")
        print(f"  • 自分のデバイスからのみアクセス可能")
        print()
        print("💻 ローカルアクセス:")
        print("  http://localhost:8000")
        print()
        print("🔴 終了するには Ctrl+C を押してください")
        print("=" * 60)
        print()

        # QRコード生成
        try:
            import qrcode
            url = f"http://{tailscale_ip}:8000"
            qr = qrcode.QRCode(border=1)
            qr.add_data(url)
            qr.make()
            print("📱 QRコード（スマホのカメラで読み取り）:")
            qr.print_ascii(invert=True)
            print()
        except ImportError:
            print("💡 Tip: qrcodeをインストールするとQRコードが表示されます")
            print("   pip install qrcode")
            print()

        # プロセスの終了を待つ
        process.wait()

    except KeyboardInterrupt:
        print()
        print("=" * 60)
        print("🛑 アプリケーションを終了しています...")
        print("=" * 60)
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
    finally:
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
