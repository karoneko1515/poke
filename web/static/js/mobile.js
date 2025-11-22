// モバイル専用JavaScript

// タブ切り替え
function showMobileTab(tabId) {
    // 全タブを非表示
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // 全ナビアイテムを非アクティブ
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 選択されたタブを表示
    document.getElementById(tabId).classList.add('active');

    // 対応するナビアイテムをアクティブに
    event.currentTarget.classList.add('active');

    // タブ切り替え時にデータをロード
    if (tabId === 'dashboard') {
        loadDashboardMobile();
    } else if (tabId === 'products') {
        loadProductsMobile();
    } else if (tabId === 'add-product') {
        loadCategoriesForFormMobile();
    } else if (tabId === 'market-price') {
        loadProductsForMarketPriceMobile();
    }
}

// ダッシュボード読み込み
async function loadDashboardMobile() {
    try {
        const result = await eel.get_portfolio_summary()();

        if (result.success) {
            const summary = result.summary;

            const html = `
                <div class="summary-card">
                    <h3>総投資額</h3>
                    <div class="value">¥${summary.total_purchase.toLocaleString()}</div>
                </div>
                <div class="summary-card">
                    <h3>現在価値</h3>
                    <div class="value">¥${summary.total_market_value.toLocaleString()}</div>
                    <div class="change ${summary.total_profit >= 0 ? 'positive' : 'negative'}">
                        ${summary.total_profit >= 0 ? '+' : ''}¥${summary.total_profit.toLocaleString()}
                        (${summary.total_profit_percentage >= 0 ? '+' : ''}${summary.total_profit_percentage.toFixed(2)}%)
                    </div>
                </div>
                <div class="summary-card">
                    <h3>保有商品数</h3>
                    <div class="value">${summary.total_products}点</div>
                </div>
            `;

            document.getElementById('summary-cards-mobile').innerHTML = html;

            // チャート描画
            loadPortfolioChartMobile();
        }
    } catch (error) {
        console.error('ダッシュボード読み込みエラー:', error);
    }
}

// ポートフォリオチャート読み込み
async function loadPortfolioChartMobile() {
    try {
        const result = await eel.get_portfolio_chart_data()();

        if (result.success) {
            const ctx = document.getElementById('portfolio-chart-mobile');
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: result.data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('チャート読み込みエラー:', error);
    }
}

// 商品一覧読み込み
async function loadProductsMobile() {
    try {
        const searchTerm = document.getElementById('search-name-mobile').value;
        const result = await eel.search_products(searchTerm || null)();

        if (result.success) {
            const products = result.products;
            let html = '';

            products.forEach(product => {
                const currentPrice = product.latest_market_price || product.purchase_price;
                const profit = currentPrice - product.purchase_price;
                const profitClass = profit >= 0 ? 'text-success' : 'text-danger';

                html += `
                    <div class="product-card">
                        <div class="product-name">${product.name}</div>
                        <div class="product-info">購入日: ${product.purchase_date}</div>
                        <div class="product-info">購入価格: ¥${product.purchase_price.toLocaleString()}</div>
                        <div class="product-info">現在価格: ¥${currentPrice.toLocaleString()}</div>
                        <div class="product-profit ${profitClass}">
                            損益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}
                        </div>
                    </div>
                `;
            });

            document.getElementById('products-list-mobile').innerHTML = html || '<div class="loading">商品がありません</div>';
        }
    } catch (error) {
        console.error('商品一覧読み込みエラー:', error);
    }
}

// 商品登録フォーム用カテゴリー読み込み
async function loadCategoriesForFormMobile() {
    try {
        const result = await eel.get_all_categories()();

        if (result.success) {
            const select = document.getElementById('category1-mobile');
            select.innerHTML = '<option value="">カテゴリーを選択</option>';

            result.categories.forEach(cat => {
                select.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }
    } catch (error) {
        console.error('カテゴリー読み込みエラー:', error);
    }
}

// 市場価格更新用商品読み込み
async function loadProductsForMarketPriceMobile() {
    try {
        const result = await eel.get_products()();

        if (result.success) {
            const select = document.getElementById('select-product-mobile');
            select.innerHTML = '<option value="">商品を選択してください</option>';

            result.products.forEach(product => {
                select.innerHTML += `<option value="${product.id}">${product.name}</option>`;
            });
        }
    } catch (error) {
        console.error('商品読み込みエラー:', error);
    }
}

// 市場価格更新
async function updateMarketPriceMobile() {
    const productId = document.getElementById('select-product-mobile').value;
    const price = document.getElementById('market-price-value-mobile').value;
    const date = document.getElementById('market-price-date-mobile').value;

    if (!productId || !price || !date) {
        alert('すべての項目を入力してください');
        return;
    }

    try {
        const result = await eel.add_market_price(productId, price, date)();

        if (result.success) {
            alert('価格を更新しました');
            document.getElementById('market-price-value-mobile').value = '';
            document.getElementById('market-price-date-mobile').value = '';
        } else {
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('価格更新エラー:', error);
        alert('価格更新に失敗しました');
    }
}

// 商品登録フォーム送信
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('add-product-form-mobile');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = document.getElementById('product-name-mobile').value;
            const date = document.getElementById('purchase-date-mobile').value;
            const purchasePrice = document.getElementById('purchase-price-mobile').value;
            const retailPrice = document.getElementById('retail-price-mobile').value;
            const category = document.getElementById('category1-mobile').value;

            try {
                const result = await eel.add_product(
                    name,
                    date,
                    purchasePrice,
                    retailPrice,
                    null,
                    category ? [category] : []
                )();

                if (result.success) {
                    alert('商品を登録しました');
                    form.reset();
                } else {
                    alert('エラー: ' + result.error);
                }
            } catch (error) {
                console.error('商品登録エラー:', error);
                alert('商品登録に失敗しました');
            }
        });
    }

    // 検索入力時のイベント
    const searchInput = document.getElementById('search-name-mobile');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            loadProductsMobile();
        });
    }

    // 初期ロード
    loadDashboardMobile();
});

// プレースホルダー関数（PC版との互換性のため）
function showSoldProducts() {
    alert('この機能はPC版をご利用ください');
}

function showCategoryManagement() {
    alert('この機能はPC版をご利用ください');
}

function showProfitLoss() {
    alert('この機能はPC版をご利用ください');
}
