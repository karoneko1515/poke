#!/usr/bin/env python3
"""
ポケモンカード資産管理アプリ - 簡単起動スクリプト

このスクリプトをダブルクリックするだけでアプリケーションを起動できます。
"""

import os
import sys
import subprocess
import webbrowser
import time

def main():
    # スクリプトのディレクトリを取得
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    print("=" * 50)
    print("🎴 ポケモンカード資産管理アプリ")
    print("=" * 50)
    print("アプリケーションを起動しています...")

    # 仮想環境の確認
    venv_python = os.path.join(script_dir, 'venv', 'bin', 'python')
    if not os.path.exists(venv_python):
        print("❌ 仮想環境が見つかりません。")
        print("以下のコマンドを実行してセットアップしてください：")
        print("python3 -m venv venv")
        print("source venv/bin/activate")
        print("pip install -r requirements.txt")
        input("Enterキーを押して終了...")
        return

    try:
        # Pythonアプリケーションを起動
        process = subprocess.Popen([venv_python, 'main.py'])

        print("✅ アプリケーションが起動しました！")
        print("📱 ブラウザで http://localhost:8000 にアクセスしてください")
        print("🔴 アプリケーションを終了するには、Ctrl+C を押してください")

        # ブラウザを自動で開く（3秒後）
        time.sleep(3)
        try:
            webbrowser.open('http://localhost:8000')
        except:
            pass

        # プロセスの終了を待つ
        process.wait()

    except KeyboardInterrupt:
        print("\n🛑 アプリケーションを終了しています...")
        try:
            process.terminate()
        except:
            pass
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        input("Enterキーを押して終了...")

if __name__ == "__main__":
    main()