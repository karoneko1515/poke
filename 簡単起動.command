#!/bin/bash

# ポケモンカード資産管理アプリ - 簡単起動スクリプト

# このスクリプトのディレクトリを取得（.appバンドル内でも動作）
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# .appバンドル内から実行された場合の処理
if [[ "$DIR" == *".app/Contents/MacOS"* ]]; then
    # アプリバンドルから3階層上がメインディレクトリ
    DIR="$(dirname "$(dirname "$(dirname "$DIR")")")"
fi

cd "$DIR"

echo "======================================"
echo "🎴 ポケモンカード資産管理アプリ"
echo "======================================"
echo "起動中..."

# 仮想環境の確認
if [ ! -f "venv/bin/activate" ]; then
    echo "❌ 仮想環境が見つかりません。"
    echo "以下のコマンドでセットアップしてください："
    echo "python3 -m venv venv"
    echo "source venv/bin/activate"
    echo "pip install eel matplotlib pillow"
    read -p "Enterキーを押して終了..."
    exit 1
fi

# Pythonアプリケーション起動
echo "✅ アプリケーションを起動しています..."
echo "📱 ブラウザで http://localhost:8000 にアクセスしてください"
echo "🔴 終了するには Ctrl+C を押してください"
echo ""

source venv/bin/activate && python main.py

echo ""
echo "アプリケーションが終了しました。"
read -p "Enterキーを押してウィンドウを閉じる..."