from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import base64
import matplotlib
matplotlib.use('Agg')  # GUI不要のバックエンド
import matplotlib.pyplot as plt
from datetime import datetime
from database import DatabaseManager

# Matplotlibの日本語フォント設定
plt.rcParams['font.family'] = ['Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Takao', 'IPAexGothic', 'IPAPGothic', 'VL PGothic', 'Noto Sans CJK JP']

# Flaskアプリケーション初期化
app = Flask(__name__, static_folder='web/static', static_url_path='/static')
CORS(app)  # CORS有効化

# データベース初期化
db = DatabaseManager()

# 静的ファイル配信
@app.route('/')
def index():
    return send_from_directory('web', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('web', path)

# ========================================
# API エンドポイント
# ========================================

@app.route('/api/ping', methods=['GET'])
def ping():
    """接続テスト用のエンドポイント"""
    return jsonify({'success': True, 'timestamp': datetime.now().isoformat()})

@app.route('/api/products', methods=['GET'])
def get_products():
    """商品一覧取得"""
    try:
        products = db.get_products()
        return jsonify({'success': True, 'products': products})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products', methods=['POST'])
def add_product():
    """商品登録"""
    try:
        data = request.json
        name = data.get('name')
        purchase_date = data.get('purchase_date')
        purchase_price = data.get('purchase_price')
        retail_price = data.get('retail_price')
        image_file = data.get('image_file')
        categories = data.get('categories', [])

        image_path = None
        if image_file:
            # Base64デコードして画像保存
            image_data = base64.b64decode(image_file.split(',')[1])
            filename = f"product_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image_path = os.path.join('web', 'static', 'images', filename)

            os.makedirs(os.path.dirname(image_path), exist_ok=True)
            with open(image_path, 'wb') as f:
                f.write(image_data)

            # データベースには相対パスで保存
            image_path = os.path.join('static', 'images', filename)

        # カテゴリーの処理
        category_list = [cat.strip() for cat in categories if cat and cat.strip()]

        product_id = db.add_product(name, purchase_date, int(purchase_price), int(retail_price), image_path, category_list)
        return jsonify({'success': True, 'product_id': product_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product_by_id(product_id):
    """商品詳細取得"""
    try:
        product = db.get_product_by_id(product_id)
        return jsonify({'success': True, 'product': product})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """商品更新"""
    try:
        data = request.json
        name = data.get('name')
        purchase_date = data.get('purchase_date')
        purchase_price = data.get('purchase_price')
        retail_price = data.get('retail_price')
        categories = data.get('categories', [])

        category_list = [cat.strip() for cat in categories if cat and cat.strip()]

        success = db.update_product(product_id, name, purchase_date, int(purchase_price), int(retail_price), category_list)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/sold', methods=['GET'])
def get_sold_products():
    """売却済み商品一覧取得"""
    try:
        products = db.get_products(include_sold=True)
        sold_products = [p for p in products if p['is_sold']]
        return jsonify({'success': True, 'products': sold_products})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/sell', methods=['POST'])
def sell_product(product_id):
    """商品売却"""
    try:
        data = request.json
        sold_price = data.get('sold_price')
        sold_date = data.get('sold_date')

        success = db.sell_product(product_id, int(sold_price), sold_date)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/search', methods=['GET'])
def search_products():
    """商品検索"""
    try:
        search_term = request.args.get('search_term')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        products = db.search_products(search_term, date_from, date_to)
        return jsonify({'success': True, 'products': products})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/market-prices', methods=['POST'])
def add_market_price():
    """市場価格追加"""
    try:
        data = request.json
        product_id = data.get('product_id')
        price = data.get('price')
        price_date = data.get('price_date')

        price_id = db.add_market_price(int(product_id), int(price), price_date)
        return jsonify({'success': True, 'price_id': price_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/market-prices/<int:price_id>', methods=['PUT'])
def update_market_price(price_id):
    """市場価格更新"""
    try:
        data = request.json
        price = data.get('price')
        price_date = data.get('price_date')

        success = db.update_market_price(price_id, int(price), price_date)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/market-prices/<int:price_id>', methods=['DELETE'])
def delete_market_price(price_id):
    """市場価格削除"""
    try:
        success = db.delete_market_price(price_id)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/market-prices', methods=['GET'])
def get_market_price_history(product_id):
    """市場価格履歴取得"""
    try:
        history = db.get_market_price_history(product_id)
        return jsonify({'success': True, 'history': history})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/portfolio/summary', methods=['GET'])
def get_portfolio_summary():
    """ポートフォリオサマリー取得"""
    try:
        summary = db.get_portfolio_summary()
        return jsonify({'success': True, 'summary': summary})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/portfolio/chart-data', methods=['GET'])
def get_portfolio_chart_data():
    """ポートフォリオグラフデータ取得"""
    try:
        period_months = request.args.get('period_months', type=int)
        products = db.get_products()

        if not products:
            return jsonify({'success': False, 'error': '商品データがありません'}), 400

        # 全商品の価格履歴を一度に取得
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT product_name, price, price_date
            FROM market_prices
            ORDER BY product_name, price_date ASC
        ''')

        # 商品名ごとに価格履歴を整理
        all_price_history = {}
        for row in cursor.fetchall():
            product_name = row[0]
            if product_name not in all_price_history:
                all_price_history[product_name] = []
            price_date_str = row[2]
            if isinstance(price_date_str, str):
                price_date_str = price_date_str.split(' ')[0]
            all_price_history[product_name].append({
                'price': row[1],
                'price_date': price_date_str
            })
        conn.close()

        # 全ての重要な日付を収集
        all_dates = set()
        for product in products:
            purchase_date = datetime.strptime(product['purchase_date'], '%Y-%m-%d')
            all_dates.add(purchase_date)

        for price_list in all_price_history.values():
            for price_entry in price_list:
                try:
                    price_date = datetime.strptime(price_entry['price_date'], '%Y-%m-%d')
                    all_dates.add(price_date)
                except:
                    continue

        # 期間フィルタリング
        if period_months:
            from datetime import timedelta
            cutoff_date = datetime.now() - timedelta(days=period_months * 30)
            all_dates = {d for d in all_dates if d >= cutoff_date}

        if not all_dates:
            return jsonify({'success': False, 'error': '指定期間にデータがありません'}), 400

        # 日付をソート
        sorted_dates = sorted(all_dates)

        # 各日付での累積値を計算
        cumulative_purchase = []
        cumulative_market = []
        dates = []

        for current_date in sorted_dates:
            total_purchase = 0
            total_market = 0

            for product in products:
                purchase_date = datetime.strptime(product['purchase_date'], '%Y-%m-%d')

                if purchase_date <= current_date:
                    total_purchase += product['purchase_price']

                    price_history = all_price_history.get(product['name'], [])
                    current_market_price = product['purchase_price']

                    for price_entry in price_history:
                        try:
                            price_date = datetime.strptime(price_entry['price_date'], '%Y-%m-%d')
                            if price_date <= current_date:
                                current_market_price = price_entry['price']
                        except:
                            continue

                    total_market += current_market_price

            dates.append(current_date.strftime('%Y-%m-%d'))
            cumulative_purchase.append(total_purchase)
            cumulative_market.append(total_market)

        return jsonify({
            'success': True,
            'data': {
                'labels': dates,
                'datasets': [
                    {
                        'label': '購入価格累計',
                        'data': cumulative_purchase,
                        'borderColor': 'rgb(54, 162, 235)',
                        'backgroundColor': 'rgba(54, 162, 235, 0.2)',
                        'tension': 0.1
                    },
                    {
                        'label': '現在価値累計',
                        'data': cumulative_market,
                        'borderColor': 'rgb(255, 99, 132)',
                        'backgroundColor': 'rgba(255, 99, 132, 0.2)',
                        'tension': 0.1
                    }
                ]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/chart-data', methods=['GET'])
def get_product_chart_data(product_id):
    """個別商品グラフデータ取得"""
    try:
        price_history = db.get_market_price_history(product_id)
        products = db.get_products()
        product = next((p for p in products if p['id'] == product_id), None)

        if not product:
            return jsonify({'success': False, 'error': '商品が見つかりません'}), 404

        if not price_history:
            return jsonify({'success': False, 'error': '価格履歴がありません'}), 400

        # データ準備
        dates = []
        prices = []

        for p in price_history:
            try:
                date_str = p['price_date']
                if isinstance(date_str, str):
                    date_part = date_str.split(' ')[0]
                    dates.append(date_part)
                else:
                    dates.append(str(date_str))
                prices.append(p['price'])
            except ValueError as e:
                dates.append(datetime.now().strftime('%Y-%m-%d'))
                prices.append(p['price'])

        return jsonify({
            'success': True,
            'data': {
                'labels': dates,
                'datasets': [
                    {
                        'label': '市場価格',
                        'data': prices,
                        'borderColor': 'rgb(75, 192, 192)',
                        'backgroundColor': 'rgba(75, 192, 192, 0.2)',
                        'tension': 0.1
                    }
                ],
                'purchase_price': product['purchase_price'],
                'product_name': product['name']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/profit-loss/details', methods=['GET'])
def get_profit_loss_details():
    """損益詳細取得"""
    try:
        details = db.get_profit_loss_details()
        return jsonify({'success': True, 'details': details})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/categories', methods=['GET'])
def get_all_categories():
    """全カテゴリー取得"""
    try:
        categories = db.get_all_categories()
        return jsonify({'success': True, 'categories': categories})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/categories', methods=['POST'])
def add_category():
    """カテゴリー追加"""
    try:
        data = request.json
        category_name = data.get('category_name')

        success = db.add_category(category_name)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/categories/<category_name>', methods=['DELETE'])
def delete_category(category_name):
    """カテゴリー削除"""
    try:
        success = db.delete_category(category_name)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/categories/analysis', methods=['GET'])
def get_category_analysis():
    """カテゴリー分析取得"""
    try:
        analysis = db.get_category_analysis()
        return jsonify({'success': True, 'analysis': analysis})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/categories/chart-data', methods=['GET'])
def get_category_chart_data():
    """カテゴリー別グラフデータ取得"""
    try:
        analysis = db.get_category_analysis()

        if not analysis:
            return jsonify({'success': False, 'error': 'カテゴリーデータがありません'}), 400

        categories = list(analysis.keys())
        purchase_values = [analysis[cat]['total_purchase'] for cat in categories]
        market_values = [analysis[cat]['total_market_value'] for cat in categories]

        return jsonify({
            'success': True,
            'data': {
                'labels': categories,
                'datasets': [
                    {
                        'label': '投資額',
                        'data': purchase_values,
                        'backgroundColor': 'rgba(54, 162, 235, 0.8)',
                        'borderColor': 'rgb(54, 162, 235)',
                        'borderWidth': 1
                    },
                    {
                        'label': '現在価値',
                        'data': market_values,
                        'backgroundColor': 'rgba(255, 99, 132, 0.8)',
                        'borderColor': 'rgb(255, 99, 132)',
                        'borderWidth': 1
                    }
                ]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/outdated', methods=['GET'])
def get_outdated_products():
    """未更新商品取得"""
    try:
        days_threshold = request.args.get('days_threshold', default=7, type=int)
        products = db.get_outdated_products(days_threshold)
        return jsonify({'success': True, 'products': products})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # 開発サーバー起動
    app.run(host='0.0.0.0', port=8000, debug=True)
