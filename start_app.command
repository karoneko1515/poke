#!/bin/bash

# ポケモンカード資産管理アプリ起動スクリプト

# 現在のディレクトリを取得
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# アプリケーションディレクトリに移動
cd "$DIR"

echo "ポケモンカード資産管理アプリを起動しています..."

# 仮想環境をアクティブ化してPythonアプリを起動
source venv/bin/activate && python main.py

# 何かキーが押されるまで待機（ターミナルを開いたままにする）
echo "アプリケーションを終了するには、ターミナルでCtrl+Cを押すか、このウィンドウを閉じてください。"
read -p "Enterキーを押してターミナルを閉じる..."