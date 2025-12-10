import eel
import os
import shutil
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import json
import base64
from io import BytesIO
from database import DatabaseManager

# Matplotlibの日本語フォント設定
plt.rcParams['font.family'] = ['Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Takao', 'IPAexGothic', 'IPAPGothic', 'VL PGothic', 'Noto Sans CJK JP']

# データベース初期化
db = DatabaseManager()

# Eelアプリケーションの初期化
eel.init('web')

@eel.expose
def add_product(name, purchase_date, purchase_price, retail_price, image_file=None, categories=None):
    try:
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
        category_list = []
        if categories:
            category_list = [cat.strip() for cat in categories if cat and cat.strip()]

        product_id = db.add_product(name, purchase_date, int(purchase_price), int(retail_price), image_path, category_list)
        return {'success': True, 'product_id': product_id}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_products():
    try:
        products = db.get_products()
        return {'success': True, 'products': products}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_sold_products():
    try:
        products = db.get_products(include_sold=True)
        sold_products = [p for p in products if p['is_sold']]
        return {'success': True, 'products': sold_products}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def add_market_price(product_id, price, price_date):
    try:
        price_id = db.add_market_price(int(product_id), int(price), price_date)
        return {'success': True, 'price_id': price_id}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def sell_product(product_id, sold_price, sold_date=None):
    try:
        success = db.sell_product(int(product_id), int(sold_price), sold_date)
        return {'success': success}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_portfolio_summary():
    try:
        summary = db.get_portfolio_summary()
        return {'success': True, 'summary': summary}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_portfolio_chart_data(period_months=None):
    try:
        products = db.get_products()

        if not products:
            return {'success': False, 'error': '商品データがありません'}

        # パフォーマンス改善: 全商品の価格履歴を一度に取得
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

        # 全ての重要な日付を収集（購入日 + 市場価格更新日）
        all_dates = set()

        # 商品購入日を追加
        for product in products:
            purchase_date = datetime.strptime(product['purchase_date'], '%Y-%m-%d')
            all_dates.add(purchase_date)

        # 市場価格更新日を追加（一度に取得したデータから）
        for price_list in all_price_history.values():
            for price_entry in price_list:
                try:
                    price_date_str = price_entry['price_date']
                    price_date = datetime.strptime(price_date_str, '%Y-%m-%d')
                    all_dates.add(price_date)
                except:
                    continue

        # 期間フィルタリング
        if period_months:
            cutoff_date = datetime.now() - timedelta(days=period_months * 30)
            all_dates = {d for d in all_dates if d >= cutoff_date}

        if not all_dates:
            return {'success': False, 'error': '指定期間にデータがありません'}

        # 日付をソート
        sorted_dates = sorted(all_dates)

        # 各日付での累積値を計算
        cumulative_purchase = []
        cumulative_market = []
        dates = []

        # パフォーマンス改善: 事前に取得した価格履歴を使用
        for current_date in sorted_dates:
            total_purchase = 0
            total_market = 0

            for product in products:
                purchase_date = datetime.strptime(product['purchase_date'], '%Y-%m-%d')

                # この日付時点で購入済みの商品のみ計算
                if purchase_date <= current_date:
                    total_purchase += product['purchase_price']

                    # この日付時点での最新市場価格を取得（事前取得したデータから）
                    price_history = all_price_history.get(product['name'], [])
                    current_market_price = product['purchase_price']  # デフォルトは購入価格

                    for price_entry in price_history:
                        try:
                            price_date_str = price_entry['price_date']
                            price_date = datetime.strptime(price_date_str, '%Y-%m-%d')

                            # この日付以前の最新価格を使用
                            if price_date <= current_date:
                                current_market_price = price_entry['price']
                        except:
                            continue

                    total_market += current_market_price

            dates.append(current_date.strftime('%Y-%m-%d'))
            cumulative_purchase.append(total_purchase)
            cumulative_market.append(total_market)

        return {
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
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def generate_portfolio_chart():
    try:
        products = db.get_products()

        if not products:
            return {'success': False, 'error': '商品データがありません'}

        # 日付ごとの累積購入価格と市場価値を計算
        purchase_data = {}
        market_data = {}

        for product in products:
            purchase_date = datetime.strptime(product['purchase_date'], '%Y-%m-%d')
            purchase_data[purchase_date] = purchase_data.get(purchase_date, 0) + product['purchase_price']

            # 最新の市場価格を使用（なければ購入価格を使用）
            current_price = product['latest_market_price'] or product['purchase_price']
            market_data[purchase_date] = market_data.get(purchase_date, 0) + current_price

        # データをソートして累積値を計算
        sorted_dates = sorted(purchase_data.keys())
        cumulative_purchase = []
        cumulative_market = []
        dates = []

        total_purchase = 0
        total_market = 0

        for date in sorted_dates:
            total_purchase += purchase_data[date]
            total_market += market_data[date]

            dates.append(date)
            cumulative_purchase.append(total_purchase)
            cumulative_market.append(total_market)

        # グラフ生成
        plt.figure(figsize=(12, 6))
        plt.plot(dates, cumulative_purchase, label='購入価格累計', marker='o', linewidth=2)
        plt.plot(dates, cumulative_market, label='現在価値累計', marker='s', linewidth=2)

        plt.title('ポートフォリオ推移', fontsize=16, fontweight='bold')
        plt.xlabel('日付', fontsize=12)
        plt.ylabel('金額 (円)', fontsize=12)
        plt.legend(fontsize=12)
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()

        # Base64エンコード
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()

        graphic = base64.b64encode(image_png).decode()
        return {'success': True, 'chart': f'data:image/png;base64,{graphic}'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_product_chart_data(product_id):
    try:
        price_history = db.get_market_price_history(int(product_id))
        products = db.get_products()
        product = next((p for p in products if p['id'] == int(product_id)), None)

        if not product:
            return {'success': False, 'error': '商品が見つかりません'}

        if not price_history:
            return {'success': False, 'error': '価格履歴がありません'}

        # データ準備
        dates = []
        prices = []

        for p in price_history:
            try:
                # price_dateの形式を柔軟にパース
                date_str = p['price_date']
                if isinstance(date_str, str):
                    # 時刻部分がある場合は日付部分のみ取得
                    date_part = date_str.split(' ')[0]
                    dates.append(date_part)
                else:
                    dates.append(str(date_str))
                prices.append(p['price'])
            except ValueError as e:
                print(f"Date parsing error for {p['price_date']}: {e}")
                # エラーの場合は現在の日付を使用
                dates.append(datetime.now().strftime('%Y-%m-%d'))
                prices.append(p['price'])

        purchase_price = product['purchase_price']

        return {
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
                'purchase_price': purchase_price,
                'product_name': product['name']
            }
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def generate_product_chart(product_id):
    try:
        price_history = db.get_market_price_history(int(product_id))
        products = db.get_products()
        product = next((p for p in products if p['id'] == int(product_id)), None)

        if not product:
            return {'success': False, 'error': '商品が見つかりません'}

        if not price_history:
            return {'success': False, 'error': '価格履歴がありません'}

        # データ準備
        dates = []
        prices = [p['price'] for p in price_history]

        for p in price_history:
            try:
                # price_dateの形式を柔軟にパース
                date_str = p['price_date']
                if isinstance(date_str, str):
                    # 時刻部分がある場合は日付部分のみ取得
                    date_part = date_str.split(' ')[0]
                    dates.append(datetime.strptime(date_part, '%Y-%m-%d'))
                else:
                    dates.append(datetime.strptime(str(date_str), '%Y-%m-%d'))
            except ValueError as e:
                print(f"Date parsing error for {p['price_date']}: {e}")
                # エラーの場合は現在の日付を使用
                dates.append(datetime.now())
        purchase_price = product['purchase_price']

        # グラフ生成
        plt.figure(figsize=(10, 6))
        plt.plot(dates, prices, label='市場価格', marker='o', linewidth=2)
        plt.axhline(y=purchase_price, color='red', linestyle='--', label=f'購入価格: ¥{purchase_price:,}')

        plt.title(f'{product["name"]} - 価格推移', fontsize=16, fontweight='bold')
        plt.xlabel('日付', fontsize=12)
        plt.ylabel('価格 (円)', fontsize=12)
        plt.legend(fontsize=12)
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()

        # Base64エンコード
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()

        graphic = base64.b64encode(image_png).decode()
        return {'success': True, 'chart': f'data:image/png;base64,{graphic}'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_market_price_history(product_id):
    try:
        history = db.get_market_price_history(int(product_id))
        return {'success': True, 'history': history}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def search_products(search_term=None, date_from=None, date_to=None):
    try:
        products = db.search_products(search_term, date_from, date_to)
        return {'success': True, 'products': products}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_profit_loss_details():
    try:
        details = db.get_profit_loss_details()
        return {'success': True, 'details': details}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_all_categories():
    try:
        categories = db.get_all_categories()
        return {'success': True, 'categories': categories}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_product_by_id(product_id):
    try:
        print(f"DEBUG: get_product_by_id called with product_id: {product_id}")
        product = db.get_product_by_id(int(product_id))
        print(f"DEBUG: get_product_by_id result: {product}")
        return {'success': True, 'product': product}
    except Exception as e:
        print(f"ERROR in get_product_by_id: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

@eel.expose
def update_product(product_id, name, purchase_date, purchase_price, retail_price, categories=None):
    try:
        print(f"DEBUG: update_product called with:")
        print(f"  product_id: {product_id} (type: {type(product_id)})")
        print(f"  name: {name} (type: {type(name)})")
        print(f"  purchase_date: {purchase_date} (type: {type(purchase_date)})")
        print(f"  purchase_price: {purchase_price} (type: {type(purchase_price)})")
        print(f"  retail_price: {retail_price} (type: {type(retail_price)})")
        print(f"  categories: {categories} (type: {type(categories)})")

        category_list = []
        if categories:
            category_list = [cat.strip() for cat in categories if cat and cat.strip()]

        print(f"  processed category_list: {category_list}")

        success = db.update_product(int(product_id), name, purchase_date, int(purchase_price), int(retail_price), category_list)
        print(f"  update_product result: {success}")
        return {'success': success}
    except Exception as e:
        print(f"ERROR in update_product: {e}")
        print(f"ERROR type: {type(e)}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

@eel.expose
def update_market_price(price_id, price, price_date):
    try:
        success = db.update_market_price(int(price_id), int(price), price_date)
        return {'success': success}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def delete_market_price(price_id):
    try:
        success = db.delete_market_price(int(price_id))
        return {'success': success}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def add_category(category_name):
    try:
        success = db.add_category(category_name)
        return {'success': success}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def delete_category(category_name):
    try:
        success = db.delete_category(category_name)
        return {'success': success}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_category_analysis():
    try:
        analysis = db.get_category_analysis()
        return {'success': True, 'analysis': analysis}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_outdated_products(days_threshold=7):
    try:
        products = db.get_outdated_products(int(days_threshold))
        return {'success': True, 'products': products}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_category_chart_data():
    try:
        analysis = db.get_category_analysis()

        if not analysis:
            return {'success': False, 'error': 'カテゴリーデータがありません'}

        # カテゴリー別投資額と現在価値のグラフを生成
        categories = list(analysis.keys())
        purchase_values = [analysis[cat]['total_purchase'] for cat in categories]
        market_values = [analysis[cat]['total_market_value'] for cat in categories]

        return {
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
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def generate_category_chart():
    try:
        analysis = db.get_category_analysis()

        if not analysis:
            return {'success': False, 'error': 'カテゴリーデータがありません'}

        # カテゴリー別投資額と現在価値のグラフを生成
        categories = list(analysis.keys())
        purchase_values = [analysis[cat]['total_purchase'] for cat in categories]
        market_values = [analysis[cat]['total_market_value'] for cat in categories]

        plt.figure(figsize=(12, 8))

        x = range(len(categories))
        width = 0.35

        plt.bar([i - width/2 for i in x], purchase_values, width, label='投資額', alpha=0.8)
        plt.bar([i + width/2 for i in x], market_values, width, label='現在価値', alpha=0.8)

        plt.title('カテゴリー別投資分析', fontsize=16, fontweight='bold')
        plt.xlabel('カテゴリー', fontsize=12)
        plt.ylabel('金額 (円)', fontsize=12)
        plt.legend(fontsize=12)
        plt.xticks(x, categories, rotation=45, ha='right')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()

        # Base64エンコード
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()

        graphic = base64.b64encode(image_png).decode()
        return {'success': True, 'chart': f'data:image/png;base64,{graphic}'}

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def ping():
    """接続テスト用のエンドポイント。モバイルSafariの接続切断を検知するために使用。"""
    return {'success': True, 'timestamp': datetime.now().isoformat()}

if __name__ == '__main__':
    # ブラウザでアプリケーションを起動
    try:
        eel.start('index.html', size=(1200, 800), port=8000)
    except Exception as e:
        print(f"アプリケーションの起動に失敗しました: {e}")