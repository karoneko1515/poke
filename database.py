import sqlite3
import datetime
import os
from typing import List, Dict, Optional

class DatabaseManager:
    def __init__(self, db_path: str = "pokemon_cards.db"):
        self.db_path = db_path
        self.init_database()

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    def init_database(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        # 商品テーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                purchase_date DATE NOT NULL,
                purchase_price INTEGER NOT NULL,
                retail_price INTEGER NOT NULL,
                image_path TEXT,
                category1 TEXT,
                category2 TEXT,
                category3 TEXT,
                category4 TEXT,
                category5 TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_sold BOOLEAN DEFAULT FALSE,
                sold_date DATE,
                sold_price INTEGER
            )
        ''')

        # 既存のテーブルにカテゴリーフィールドを追加（存在しない場合）
        try:
            cursor.execute('ALTER TABLE products ADD COLUMN category1 TEXT')
        except sqlite3.OperationalError:
            pass  # カラムが既に存在する場合

        try:
            cursor.execute('ALTER TABLE products ADD COLUMN category2 TEXT')
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute('ALTER TABLE products ADD COLUMN category3 TEXT')
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute('ALTER TABLE products ADD COLUMN category4 TEXT')
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute('ALTER TABLE products ADD COLUMN category5 TEXT')
        except sqlite3.OperationalError:
            pass

        # カテゴリー管理テーブル（ユーザーが作成したカテゴリーを保存）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 市場価格履歴テーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS market_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                price INTEGER NOT NULL,
                price_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        ''')

        # 既存のmarket_pricesテーブルにproduct_nameフィールドを追加
        try:
            cursor.execute('ALTER TABLE market_prices ADD COLUMN product_name TEXT')
            # 既存データのproduct_nameを更新
            cursor.execute('''
                UPDATE market_prices
                SET product_name = (
                    SELECT name FROM products WHERE products.id = market_prices.product_id
                )
                WHERE product_name IS NULL
            ''')
        except sqlite3.OperationalError:
            pass  # カラムが既に存在する場合

        # パフォーマンス改善: インデックス追加
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_market_prices_product_name ON market_prices(product_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_market_prices_price_date ON market_prices(price_date DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_market_prices_product_id ON market_prices(product_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_is_sold ON products(is_sold)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_purchase_date ON products(purchase_date)')

        conn.commit()
        conn.close()

    def add_product(self, name: str, purchase_date: str, purchase_price: int,
                   retail_price: int, image_path: str = None, categories: List[str] = None) -> int:
        conn = self.get_connection()
        cursor = conn.cursor()

        # カテゴリーを5個まで対応
        cat1 = categories[0] if categories and len(categories) > 0 else None
        cat2 = categories[1] if categories and len(categories) > 1 else None
        cat3 = categories[2] if categories and len(categories) > 2 else None
        cat4 = categories[3] if categories and len(categories) > 3 else None
        cat5 = categories[4] if categories and len(categories) > 4 else None

        cursor.execute('''
            INSERT INTO products (name, purchase_date, purchase_price, retail_price, image_path,
                                category1, category2, category3, category4, category5)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name, purchase_date, purchase_price, retail_price, image_path,
              cat1, cat2, cat3, cat4, cat5))

        product_id = cursor.lastrowid

        # 新しいカテゴリーを categories テーブルに追加
        if categories:
            for category in categories:
                if category and category.strip():
                    try:
                        cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category.strip(),))
                    except:
                        pass

        conn.commit()
        conn.close()
        return product_id

    def get_products(self, include_sold: bool = False) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()

        # パフォーマンス改善: ROW_NUMBER()の代わりにサブクエリで最新価格を取得
        query = '''
            SELECT p.*,
                   mp.price as latest_market_price,
                   mp.price_date as latest_price_date
            FROM products p
            LEFT JOIN market_prices mp ON p.name = mp.product_name
                AND mp.price_date = (
                    SELECT MAX(price_date)
                    FROM market_prices
                    WHERE product_name = p.name
                )
        '''

        if not include_sold:
            query += ' WHERE p.is_sold = FALSE'

        cursor.execute(query)
        products = []
        for row in cursor.fetchall():
            # 実際のデータベース構造に基づいてフィールド位置を特定
            # JOIN結果の構造: products.* (15フィールド), latest_market_price, latest_price_date

            product = {
                'id': row[0],
                'name': row[1],
                'purchase_date': row[2],
                'purchase_price': row[3],
                'retail_price': row[4],
                'image_path': row[5],
                'created_at': row[6],
                'is_sold': row[7],
                'sold_date': row[8],
                'sold_price': row[9],
                'latest_market_price': row[15] if len(row) > 15 else None,
                'latest_price_date': row[16] if len(row) > 16 else None
            }

            # カテゴリーをリストにまとめる（フィールドが存在する場合のみ）
            categories = []
            try:
                # category1-5 は位置 10-14
                for i in range(10, 15):
                    if len(row) > i and row[i]:
                        categories.append(row[i])
            except IndexError:
                # カテゴリーフィールドが存在しない古いデータの場合
                categories = []

            product['categories'] = categories
            products.append(product)

        conn.close()
        return products

    def add_market_price(self, product_id: int, price: int, price_date: str) -> int:
        conn = self.get_connection()
        cursor = conn.cursor()

        # 商品名を取得
        cursor.execute('SELECT name FROM products WHERE id = ?', (product_id,))
        product_name = cursor.fetchone()[0]

        cursor.execute('''
            INSERT INTO market_prices (product_id, product_name, price, price_date)
            VALUES (?, ?, ?, ?)
        ''', (product_id, product_name, price, price_date))

        price_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return price_id

    def get_market_price_history(self, product_id: int) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()

        # 商品名を取得
        cursor.execute('SELECT name FROM products WHERE id = ?', (product_id,))
        product_name_result = cursor.fetchone()

        if not product_name_result:
            conn.close()
            return []

        product_name = product_name_result[0]

        # 同名商品の価格履歴を取得
        cursor.execute('''
            SELECT * FROM market_prices
            WHERE product_name = ?
            ORDER BY price_date ASC
        ''', (product_name,))

        prices = []
        for row in cursor.fetchall():
            # データベース構造に基づいてフィールドを正しく取得
            # 実際のmarket_prices構造: id, product_id, price, price_date, created_at, product_name

            if len(row) >= 6:  # 新しい構造（product_nameフィールド付き）
                prices.append({
                    'id': row[0],
                    'product_id': row[1],
                    'price': row[2],
                    'price_date': row[3],
                    'created_at': row[4],
                    'product_name': row[5]
                })
            else:  # 古い構造（product_nameフィールドなし）
                prices.append({
                    'id': row[0],
                    'product_id': row[1],
                    'price': row[2],
                    'price_date': row[3],
                    'created_at': row[4],
                    'product_name': product_name
                })

        conn.close()
        return prices

    def sell_product(self, product_id: int, sold_price: int, sold_date: str = None) -> bool:
        if sold_date is None:
            sold_date = datetime.date.today().isoformat()

        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE products
            SET is_sold = TRUE, sold_date = ?, sold_price = ?
            WHERE id = ?
        ''', (sold_date, sold_price, product_id))

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    def get_portfolio_summary(self) -> Dict:
        conn = self.get_connection()
        cursor = conn.cursor()

        # 総購入金額（保有中）
        cursor.execute('SELECT SUM(purchase_price) FROM products WHERE is_sold = FALSE')
        total_purchase = cursor.fetchone()[0] or 0

        # 現在の市場価値総額 - パフォーマンス改善版
        cursor.execute('''
            SELECT SUM(COALESCE(mp.price, p.purchase_price))
            FROM products p
            LEFT JOIN market_prices mp ON p.name = mp.product_name
                AND mp.price_date = (
                    SELECT MAX(price_date)
                    FROM market_prices
                    WHERE product_name = p.name
                )
            WHERE p.is_sold = FALSE
        ''')
        total_market_value = cursor.fetchone()[0] or 0

        # 売却済み商品の損益
        cursor.execute('''
            SELECT SUM(sold_price - purchase_price)
            FROM products
            WHERE is_sold = TRUE
        ''')
        realized_profit = cursor.fetchone()[0] or 0

        # 全期間の総投資額
        cursor.execute('SELECT SUM(purchase_price) FROM products')
        total_invested = cursor.fetchone()[0] or 0

        # 保有商品数
        cursor.execute('SELECT COUNT(*) FROM products WHERE is_sold = FALSE')
        holding_count = cursor.fetchone()[0] or 0

        # 売却済み商品数
        cursor.execute('SELECT COUNT(*) FROM products WHERE is_sold = TRUE')
        sold_count = cursor.fetchone()[0] or 0

        # 最高益商品（売却済み）
        cursor.execute('''
            SELECT name, (sold_price - purchase_price) as profit
            FROM products
            WHERE is_sold = TRUE
            ORDER BY profit DESC
            LIMIT 1
        ''')
        best_sold_result = cursor.fetchone()
        best_sold = {'name': best_sold_result[0], 'profit': best_sold_result[1]} if best_sold_result else None

        # 最高益商品（保有中）- パフォーマンス改善版
        cursor.execute('''
            SELECT p.name, (COALESCE(mp.price, p.purchase_price) - p.purchase_price) as unrealized_profit
            FROM products p
            LEFT JOIN market_prices mp ON p.name = mp.product_name
                AND mp.price_date = (
                    SELECT MAX(price_date)
                    FROM market_prices
                    WHERE product_name = p.name
                )
            WHERE p.is_sold = FALSE
            ORDER BY unrealized_profit DESC
            LIMIT 1
        ''')
        best_holding_result = cursor.fetchone()
        best_holding = {'name': best_holding_result[0], 'profit': best_holding_result[1]} if best_holding_result else None

        # 平均保有期間
        cursor.execute('''
            SELECT AVG(julianday('now') - julianday(purchase_date)) as avg_days
            FROM products
            WHERE is_sold = FALSE
        ''')
        avg_holding_days = cursor.fetchone()[0] or 0

        conn.close()

        # ROI計算
        roi = (total_market_value / total_purchase * 100 - 100) if total_purchase > 0 else 0
        total_roi = ((total_market_value + realized_profit) / total_invested * 100 - 100) if total_invested > 0 else 0

        return {
            'total_purchase': total_purchase,
            'total_market_value': total_market_value,
            'unrealized_profit': total_market_value - total_purchase,
            'realized_profit': realized_profit,
            'total_profit': (total_market_value - total_purchase) + realized_profit,
            'total_invested': total_invested,
            'roi': roi,
            'total_roi': total_roi,
            'holding_count': holding_count,
            'sold_count': sold_count,
            'best_sold': best_sold,
            'best_holding': best_holding,
            'avg_holding_days': avg_holding_days
        }

    def search_products(self, search_term: str = None, date_from: str = None, date_to: str = None) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()

        # パフォーマンス改善版
        query = '''
            SELECT p.*,
                   mp.price as latest_market_price,
                   mp.price_date as latest_price_date
            FROM products p
            LEFT JOIN market_prices mp ON p.name = mp.product_name
                AND mp.price_date = (
                    SELECT MAX(price_date)
                    FROM market_prices
                    WHERE product_name = p.name
                )
            WHERE p.is_sold = FALSE
        '''

        params = []

        if search_term:
            query += ' AND p.name LIKE ?'
            params.append(f'%{search_term}%')

        if date_from:
            query += ' AND p.purchase_date >= ?'
            params.append(date_from)

        if date_to:
            query += ' AND p.purchase_date <= ?'
            params.append(date_to)

        query += ' ORDER BY p.purchase_date DESC'

        cursor.execute(query, params)
        products = []
        for row in cursor.fetchall():
            # 実際のデータベース構造に基づいてフィールド位置を特定
            # JOIN結果の構造: products.* (15フィールド), latest_market_price, latest_price_date

            product = {
                'id': row[0],
                'name': row[1],
                'purchase_date': row[2],
                'purchase_price': row[3],
                'retail_price': row[4],
                'image_path': row[5],
                'created_at': row[6],
                'is_sold': row[7],
                'sold_date': row[8],
                'sold_price': row[9],
                'latest_market_price': row[15] if len(row) > 15 else None,
                'latest_price_date': row[16] if len(row) > 16 else None
            }

            # カテゴリーをリストにまとめる（フィールドが存在する場合のみ）
            categories = []
            try:
                # category1-5 は位置 10-14
                for i in range(10, 15):
                    if len(row) > i and row[i]:
                        categories.append(row[i])
            except IndexError:
                # カテゴリーフィールドが存在しない古いデータの場合
                categories = []

            product['categories'] = categories
            products.append(product)

        conn.close()
        return products

    def get_profit_loss_details(self) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()

        # 保有中商品の損益詳細 - パフォーマンス改善版
        cursor.execute('''
            SELECT p.id, p.name, p.purchase_date, p.purchase_price,
                   COALESCE(mp.price, p.purchase_price) as current_price,
                   (COALESCE(mp.price, p.purchase_price) - p.purchase_price) as unrealized_profit,
                   CASE
                       WHEN p.purchase_price > 0 THEN
                           ((COALESCE(mp.price, p.purchase_price) - p.purchase_price) * 100.0 / p.purchase_price)
                       ELSE 0
                   END as profit_rate
            FROM products p
            LEFT JOIN market_prices mp ON p.name = mp.product_name
                AND mp.price_date = (
                    SELECT MAX(price_date)
                    FROM market_prices
                    WHERE product_name = p.name
                )
            WHERE p.is_sold = FALSE
            ORDER BY unrealized_profit DESC
        ''')

        holding_details = []
        for row in cursor.fetchall():
            holding_details.append({
                'id': row[0],
                'name': row[1],
                'purchase_date': row[2],
                'purchase_price': row[3],
                'current_price': row[4],
                'unrealized_profit': row[5],
                'profit_rate': row[6],
                'status': 'holding'
            })

        # 売却済み商品の損益詳細
        cursor.execute('''
            SELECT id, name, purchase_date, purchase_price, sold_price, sold_date,
                   (sold_price - purchase_price) as realized_profit,
                   CASE
                       WHEN purchase_price > 0 THEN
                           ((sold_price - purchase_price) * 100.0 / purchase_price)
                       ELSE 0
                   END as profit_rate
            FROM products
            WHERE is_sold = TRUE
            ORDER BY realized_profit DESC
        ''')

        sold_details = []
        for row in cursor.fetchall():
            sold_details.append({
                'id': row[0],
                'name': row[1],
                'purchase_date': row[2],
                'purchase_price': row[3],
                'current_price': row[4],
                'sold_date': row[5],
                'realized_profit': row[6],
                'profit_rate': row[7],
                'status': 'sold'
            })

        conn.close()
        return holding_details + sold_details

    def get_all_categories(self) -> List[str]:
        """登録されているカテゴリー一覧を取得"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT name FROM categories ORDER BY name')
        categories = [row[0] for row in cursor.fetchall()]

        conn.close()
        return categories

    def add_category(self, category_name: str) -> bool:
        """新しいカテゴリーを追加"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('INSERT INTO categories (name) VALUES (?)', (category_name.strip(),))
            success = True
        except sqlite3.IntegrityError:
            # 既に存在する場合
            success = False

        conn.commit()
        conn.close()
        return success

    def delete_category(self, category_name: str) -> bool:
        """カテゴリーを削除"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('DELETE FROM categories WHERE name = ?', (category_name,))
        success = cursor.rowcount > 0

        conn.commit()
        conn.close()
        return success

    def update_product(self, product_id: int, name: str, purchase_date: str,
                      purchase_price: int, retail_price: int, categories: List[str] = None) -> bool:
        """商品情報を更新"""
        print(f"DEBUG: update_product called with:")
        print(f"  product_id: {product_id}")
        print(f"  name: {name}")
        print(f"  purchase_date: {purchase_date}")
        print(f"  purchase_price: {purchase_price}")
        print(f"  retail_price: {retail_price}")
        print(f"  categories: {categories}")

        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # カテゴリーを5個まで対応
            cat1 = categories[0] if categories and len(categories) > 0 else None
            cat2 = categories[1] if categories and len(categories) > 1 else None
            cat3 = categories[2] if categories and len(categories) > 2 else None
            cat4 = categories[3] if categories and len(categories) > 3 else None
            cat5 = categories[4] if categories and len(categories) > 4 else None

            print(f"  processed categories: {cat1}, {cat2}, {cat3}, {cat4}, {cat5}")

            cursor.execute('''
                UPDATE products
                SET name = ?, purchase_date = ?, purchase_price = ?, retail_price = ?,
                    category1 = ?, category2 = ?, category3 = ?, category4 = ?, category5 = ?
                WHERE id = ?
            ''', (name, purchase_date, purchase_price, retail_price,
                  cat1, cat2, cat3, cat4, cat5, product_id))

            print(f"  rowcount after update: {cursor.rowcount}")

            # 新しいカテゴリーを categories テーブルに追加
            if categories:
                for category in categories:
                    if category and category.strip():
                        try:
                            cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category.strip(),))
                        except Exception as e:
                            print(f"  Warning: Failed to insert category {category}: {e}")

            # UPDATEが実行されたことを確認（rowcountが0でもエラーでなければ成功）
            conn.commit()

            # 実際に更新されたかを確認するため、商品が存在するかチェック
            cursor.execute('SELECT COUNT(*) FROM products WHERE id = ?', (product_id,))
            exists = cursor.fetchone()[0] > 0
            success = exists  # 商品が存在すれば更新成功とみなす

            print(f"  rowcount: {cursor.rowcount}")
            print(f"  product exists: {exists}")
            print(f"  final success: {success}")

        except Exception as e:
            print(f"  Exception in update_product: {e}")
            import traceback
            traceback.print_exc()
            success = False
        finally:
            conn.close()

        return success

    def update_market_price(self, price_id: int, price: int, price_date: str) -> bool:
        """市場価格を更新"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE market_prices
            SET price = ?, price_date = ?
            WHERE id = ?
        ''', (price, price_date, price_id))

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    def delete_market_price(self, price_id: int) -> bool:
        """市場価格を削除"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('DELETE FROM market_prices WHERE id = ?', (price_id,))

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    def get_product_by_id(self, product_id: int) -> Dict:
        """商品IDで商品を取得"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM products WHERE id = ?', (product_id,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            return None

        # 実際のデータベース構造に基づいてフィールド位置を特定
        # 現在の構造: id, name, purchase_date, purchase_price, retail_price, image_path,
        # created_at, is_sold, sold_date, sold_price, category1, category2, category3, category4, category5

        product = {
            'id': row[0],
            'name': row[1],
            'purchase_date': row[2],
            'purchase_price': row[3],
            'retail_price': row[4],
            'image_path': row[5] if row[5] is not None else '',
            'created_at': row[6] if len(row) > 6 else None,
            'is_sold': bool(row[7]) if len(row) > 7 else False,
            'sold_date': row[8] if len(row) > 8 else None,
            'sold_price': row[9] if len(row) > 9 else None
        }

        # カテゴリーをリストにまとめる（フィールドが存在する場合のみ）
        categories = []
        try:
            # category1-5 は位置 10-14
            for i in range(10, 15):
                if len(row) > i and row[i] is not None and str(row[i]).strip():
                    categories.append(str(row[i]).strip())
        except (IndexError, AttributeError, TypeError):
            # カテゴリーフィールドが存在しない古いデータの場合
            categories = []

        product['categories'] = categories

        conn.close()
        return product

    def get_category_analysis(self) -> Dict:
        """カテゴリー別の分析データを取得"""
        conn = self.get_connection()
        cursor = conn.cursor()

        # 全カテゴリーのリスト取得
        all_categories = set()
        cursor.execute('SELECT category1, category2, category3, category4, category5 FROM products')
        for row in cursor.fetchall():
            for i in range(5):
                if row[i] and row[i].strip():
                    all_categories.add(row[i].strip())

        category_data = {}

        for category in all_categories:
            # カテゴリー別の統計を取得
            cursor.execute('''
                SELECT
                    COUNT(*) as count,
                    SUM(purchase_price) as total_purchase,
                    AVG(purchase_price) as avg_purchase,
                    SUM(CASE WHEN is_sold = 1 THEN sold_price - purchase_price ELSE 0 END) as realized_profit
                FROM products p
                WHERE (category1 = ? OR category2 = ? OR category3 = ? OR category4 = ? OR category5 = ?)
                  AND is_sold = 0
            ''', (category, category, category, category, category))

            holding_result = cursor.fetchone()

            # 売却済み商品の統計
            cursor.execute('''
                SELECT
                    COUNT(*) as sold_count,
                    AVG(sold_price - purchase_price) as avg_profit
                FROM products p
                WHERE (category1 = ? OR category2 = ? OR category3 = ? OR category4 = ? OR category5 = ?)
                  AND is_sold = 1
            ''', (category, category, category, category, category))

            sold_result = cursor.fetchone()

            # 現在価値（市場価格考慮）- パフォーマンス改善版
            cursor.execute('''
                SELECT SUM(COALESCE(mp.price, p.purchase_price)) as total_market_value
                FROM products p
                LEFT JOIN market_prices mp ON p.name = mp.product_name
                    AND mp.price_date = (
                        SELECT MAX(price_date)
                        FROM market_prices
                        WHERE product_name = p.name
                    )
                WHERE (p.category1 = ? OR p.category2 = ? OR p.category3 = ? OR p.category4 = ? OR p.category5 = ?)
                  AND p.is_sold = 0
            ''', (category, category, category, category, category))

            market_result = cursor.fetchone()

            category_data[category] = {
                'holding_count': holding_result[0] or 0,
                'total_purchase': holding_result[1] or 0,
                'avg_purchase': holding_result[2] or 0,
                'total_market_value': market_result[0] or 0,
                'unrealized_profit': (market_result[0] or 0) - (holding_result[1] or 0),
                'sold_count': sold_result[0] or 0,
                'avg_realized_profit': sold_result[1] or 0,
                'total_items': (holding_result[0] or 0) + (sold_result[0] or 0)
            }

        conn.close()
        return category_data

    def get_outdated_products(self, days_threshold: int = 7) -> List[Dict]:
        """1週間以上更新されていない商品をリストアップ - パフォーマンス改善版"""
        conn = self.get_connection()
        cursor = conn.cursor()

        # 現在の日付から指定日数前の日付を計算
        cursor.execute('''
            SELECT p.id, p.name, p.purchase_date, p.purchase_price,
                   mp.price as latest_market_price, mp.price_date as latest_price_date,
                   julianday('now') - julianday(COALESCE(mp.price_date, p.purchase_date)) as days_since_update
            FROM products p
            LEFT JOIN market_prices mp ON p.name = mp.product_name
                AND mp.price_date = (
                    SELECT MAX(price_date)
                    FROM market_prices
                    WHERE product_name = p.name
                )
            WHERE p.is_sold = FALSE
              AND (mp.price_date IS NULL OR julianday('now') - julianday(mp.price_date) >= ?)
            ORDER BY days_since_update DESC
        ''', (days_threshold,))

        outdated_products = []
        for row in cursor.fetchall():
            outdated_products.append({
                'id': row[0],
                'name': row[1],
                'purchase_date': row[2],
                'purchase_price': row[3],
                'latest_market_price': row[4],
                'latest_price_date': row[5],
                'days_since_update': int(row[6]) if row[6] else None
            })

        conn.close()
        return outdated_products