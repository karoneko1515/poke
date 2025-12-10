// グローバル変数
let currentProducts = [];
let currentSoldProducts = [];
let sellModal;
let editModal;
let pastProductsModal;
let priceEditModal;

// パフォーマンス改善: キャッシュ機能
let productsCache = null;
let categoriesCache = null;
let dashboardCache = null;
let cacheTimestamp = {
    products: null,
    categories: null,
    dashboard: null
};
const CACHE_DURATION = 30000; // 30秒

// 接続監視機能（モバイルSafari対策）
let isConnectionAlive = true;
let connectionCheckInterval = null;
let pageVisibilitySupported = typeof document.hidden !== 'undefined';

// キャッシュ無効化関数
function invalidateCache(type = 'all') {
    if (type === 'all' || type === 'products') {
        productsCache = null;
        cacheTimestamp.products = null;
    }
    if (type === 'all' || type === 'categories') {
        categoriesCache = null;
        cacheTimestamp.categories = null;
    }
    if (type === 'all' || type === 'dashboard') {
        dashboardCache = null;
        cacheTimestamp.dashboard = null;
    }
}

// 接続チェック関数（モバイルSafari対策）
async function checkConnection() {
    try {
        const result = await Promise.race([
            eel.ping()(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);

        if (result && result.success) {
            if (!isConnectionAlive) {
                console.log('接続が復帰しました');
                isConnectionAlive = true;
                hideConnectionWarning();
            }
            return true;
        } else {
            throw new Error('Ping failed');
        }
    } catch (error) {
        console.error('接続チェック失敗:', error);
        if (isConnectionAlive) {
            console.warn('バックエンドとの接続が切断されました');
            isConnectionAlive = false;
            showConnectionWarning();
        }
        return false;
    }
}

// 接続警告を表示
function showConnectionWarning() {
    // 既に警告が表示されている場合は何もしない
    if (document.getElementById('connection-warning')) {
        return;
    }

    const warning = document.createElement('div');
    warning.id = 'connection-warning';
    warning.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(45deg, #ff6b6b, #ee5a6f);
        color: white;
        padding: 15px 30px;
        border-radius: 25px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: bold;
        text-align: center;
        border: 3px solid #fff;
        animation: slideDown 0.5s ease-out;
    `;
    warning.innerHTML = `
        <div style="font-size: 1rem; margin-bottom: 5px;">⚠️ サーバーとの接続が切断されました</div>
        <div style="font-size: 0.85rem; margin-bottom: 10px;">ページを再読み込みしてください</div>
        <button onclick="location.reload()"
                style="background: white; color: #ff6b6b; border: none; padding: 8px 20px;
                       border-radius: 15px; font-weight: bold; cursor: pointer; font-size: 0.9rem;">
            再読み込み
        </button>
    `;

    // アニメーション定義を追加
    if (!document.getElementById('connection-warning-style')) {
        const style = document.createElement('style');
        style.id = 'connection-warning-style';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateX(-50%) translateY(-100px);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(warning);
}

// 接続警告を非表示
function hideConnectionWarning() {
    const warning = document.getElementById('connection-warning');
    if (warning) {
        warning.style.animation = 'slideDown 0.5s ease-out reverse';
        setTimeout(() => {
            if (warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        }, 500);
    }
}

// ページの可視性が変わったときの処理
function handleVisibilityChange() {
    if (pageVisibilitySupported) {
        if (!document.hidden) {
            // ページがフォアグラウンドに戻った
            console.log('ページがアクティブになりました。接続をチェックします...');
            checkConnection();
        }
    }
}

// 定期的な接続チェックを開始
function startConnectionMonitoring() {
    // 既にインターバルが設定されている場合はクリア
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
    }

    // 30秒ごとに接続チェック
    connectionCheckInterval = setInterval(() => {
        if (!document.hidden) {
            checkConnection();
        }
    }, 30000);

    // 可視性変更イベントリスナーを追加
    if (pageVisibilitySupported) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    console.log('接続監視を開始しました');
}

// ローディングオーバーレイを表示
function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// ローディングオーバーレイを非表示
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');

    // ローディングオーバーレイを表示
    showLoadingOverlay();

    // モーダル初期化
    try {
        sellModal = new bootstrap.Modal(document.getElementById('sellModal'));
        editModal = new bootstrap.Modal(document.getElementById('editModal'));
        pastProductsModal = new bootstrap.Modal(document.getElementById('pastProductsModal'));
        priceEditModal = new bootstrap.Modal(document.getElementById('priceEditModal'));
    } catch (error) {
        console.error('Modal initialization error:', error);
    }

    // 今日の日付をデフォルト値に設定
    try {
        const today = new Date().toISOString().split('T')[0];
        const purchaseDate = document.getElementById('purchase-date');
        const priceDate = document.getElementById('price-date');
        const sellDate = document.getElementById('sell-date');

        if (purchaseDate) purchaseDate.value = today;
        if (priceDate) priceDate.value = today;
        if (sellDate) sellDate.value = today;
    } catch (error) {
        console.error('Date initialization error:', error);
    }

    // 未更新期間の閾値設定を読み込み
    try {
        loadOutdatedDaysThreshold();
    } catch (error) {
        console.error('Outdated days threshold initialization error:', error);
    }

    // 少し遅らせて初期データ読み込み（並列化でパフォーマンス改善）
    setTimeout(async () => {
        try {
            // 複数のAPI呼び出しを並列実行
            await Promise.all([
                loadDashboard(),
                loadProductsWithCategories(),
                loadCategoryOptionsForAllSelects()
            ]);
            console.log('初期データの読み込みが完了しました');
        } catch (error) {
            console.error('Data loading error:', error);
        } finally {
            // データ読み込み完了後、ローディングオーバーレイを非表示
            hideLoadingOverlay();
        }
    }, 100);

    // フォームイベントリスナー
    try {
        setupFormHandlers();
    } catch (error) {
        console.error('Form handler setup error:', error);
    }

    // 接続監視を開始（モバイルSafari対策）
    try {
        startConnectionMonitoring();
    } catch (error) {
        console.error('Connection monitoring setup error:', error);
    }

    console.log('App initialization complete');
});

// タブ表示切替
function showTab(tabName, element) {
    console.log('Switching to tab:', tabName);

    try {
        // 全てのタブを非表示
        const tabs = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => tab.style.display = 'none');

        // 指定されたタブを表示
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.style.display = 'block';
            console.log('Tab displayed:', tabName);
        } else {
            console.error('Tab not found:', tabName);
            return;
        }

        // ナビゲーションのアクティブ状態更新
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        if (element) {
            element.classList.add('active');
        }
    } catch (error) {
        console.error('Error in showTab:', error);
    }

    // タブごとの初期化処理
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'products':
            loadProductsWithCategories();
            break;
        case 'add-product':
            loadCategoryOptionsForAllSelects();
            break;
        case 'market-price':
            loadProductsForPriceUpdate();
            loadOutdatedProducts();
            break;
        case 'charts':
            loadProductsForChart();
            loadCategoryAnalysis();
            break;
        case 'profit-loss':
            loadProfitLossDetails();
            break;
        case 'sold-products':
            loadSoldProducts();
            break;
        case 'category-management':
            loadCategoryManagement();
            break;
    }
}

// フォームハンドラー設定
function setupFormHandlers() {
    // 商品登録フォーム
    document.getElementById('product-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addProduct();
    });

    // 画像プレビュー
    document.getElementById('product-image').addEventListener('change', function(e) {
        previewImage(e.target.files[0]);
    });

    // 市場価格更新フォーム
    document.getElementById('price-form').addEventListener('submit', function(e) {
        e.preventDefault();
        updateMarketPrice();
    });

    // 価格更新商品選択
    document.getElementById('price-product').addEventListener('change', function() {
        loadPriceHistory();
    });

    // カテゴリー管理フォーム
    document.getElementById('category-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addNewCategory();
    });
}

// ダッシュボード読み込み（キャッシュ対応）
async function loadDashboard() {
    try {
        const now = Date.now();

        // キャッシュが有効ならそれを使用
        if (dashboardCache && cacheTimestamp.dashboard && (now - cacheTimestamp.dashboard < CACHE_DURATION)) {
            displaySummaryCards(dashboardCache);
            return;
        }

        const result = await eel.get_portfolio_summary()();

        if (result.success) {
            dashboardCache = result.summary;
            cacheTimestamp.dashboard = now;
            displaySummaryCards(result.summary);
        } else {
            showAlert('error', 'サマリー情報の読み込みに失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', 'サマリー情報の読み込み中にエラーが発生しました');
    }
}

// サマリーカード表示
function displaySummaryCards(summary) {
    // マイルストーン達成チェック
    checkProfitMilestones(summary.total_profit);

    const summaryHTML = `
        <div class="col-md-3 mb-3">
            <div class="card summary-card text-info">
                <h3>総投資額</h3>
                <div class="display-6">¥${summary.total_purchase.toLocaleString()}</div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card summary-card text-success">
                <h3>現在価値</h3>
                <div class="display-6 clickable-value" onclick="playBallAnimation('${summary.total_market_value.toLocaleString()}')">¥${summary.total_market_value.toLocaleString()}</div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card summary-card ${summary.unrealized_profit >= 0 ? 'text-success' : 'text-danger'}">
                <h3>含み損益</h3>
                <div class="display-6">${summary.unrealized_profit >= 0 ? '+' : ''}¥${summary.unrealized_profit.toLocaleString()}</div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card summary-card ${summary.total_profit >= 0 ? 'text-success' : 'text-danger'}">
                <h3>総損益</h3>
                <div class="display-6">${summary.total_profit >= 0 ? '+' : ''}¥${summary.total_profit.toLocaleString()}</div>
            </div>
        </div>
    `;

    document.getElementById('summary-cards').innerHTML = summaryHTML;

    // パフォーマンス統計
    const performanceHTML = `
        <div class="row">
            <div class="col-6">
                <strong>ROI (保有中):</strong><br>
                <span class="${summary.roi >= 0 ? 'text-success' : 'text-danger'}">${summary.roi.toFixed(2)}%</span>
            </div>
            <div class="col-6">
                <strong>総合ROI:</strong><br>
                <span class="${summary.total_roi >= 0 ? 'text-success' : 'text-danger'}">${summary.total_roi.toFixed(2)}%</span>
            </div>
        </div>
        <hr>
        <div class="row">
            <div class="col-6">
                <strong>最高益商品 (保有中):</strong><br>
                ${summary.best_holding ? `${summary.best_holding.name}<br><span class="text-success">+¥${summary.best_holding.profit.toLocaleString()}</span>` : '該当なし'}
            </div>
            <div class="col-6">
                <strong>最高益商品 (売却済み):</strong><br>
                ${summary.best_sold ? `${summary.best_sold.name}<br><span class="text-success">+¥${summary.best_sold.profit.toLocaleString()}</span>` : '該当なし'}
            </div>
        </div>
    `;

    document.getElementById('performance-stats').innerHTML = performanceHTML;

    // ポートフォリオ情報
    const portfolioHTML = `
        <div class="row">
            <div class="col-6">
                <strong>保有商品数:</strong><br>
                <span class="h5">${summary.holding_count}個</span>
            </div>
            <div class="col-6">
                <strong>売却済み商品数:</strong><br>
                <span class="h5">${summary.sold_count}個</span>
            </div>
        </div>
        <hr>
        <div class="row">
            <div class="col-6">
                <strong>平均保有期間:</strong><br>
                <span class="h6">${Math.round(summary.avg_holding_days)}日</span>
            </div>
            <div class="col-6">
                <strong>実現損益:</strong><br>
                <span class="${summary.realized_profit >= 0 ? 'text-success' : 'text-danger'}">${summary.realized_profit >= 0 ? '+' : ''}¥${summary.realized_profit.toLocaleString()}</span>
            </div>
        </div>
        <hr>
        <div class="text-center">
            <strong>総投資額 (全期間):</strong><br>
            <span class="h5">¥${summary.total_invested.toLocaleString()}</span>
        </div>
    `;

    document.getElementById('portfolio-info').innerHTML = portfolioHTML;
}

// 商品一覧読み込み（キャッシュ対応）
async function loadProducts() {
    try {
        const now = Date.now();

        // キャッシュが有効ならそれを使用
        if (productsCache && cacheTimestamp.products && (now - cacheTimestamp.products < CACHE_DURATION)) {
            currentProducts = productsCache;
            displayProducts(currentProducts);
            return;
        }

        const result = await eel.get_products()();

        if (result.success) {
            productsCache = result.products;
            cacheTimestamp.products = now;
            currentProducts = result.products;
            displayProducts(currentProducts);
        } else {
            showAlert('error', '商品情報の読み込みに失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '商品情報の読み込み中にエラーが発生しました');
    }
}

// 商品一覧表示
function displayProducts(products) {
    const tbody = document.getElementById('products-table');

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">商品が登録されていません</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => {
        const currentPrice = product.latest_market_price || product.purchase_price;
        const profit = currentPrice - product.purchase_price;
        const profitRate = product.purchase_price > 0 ? ((profit / product.purchase_price) * 100) : 0;
        const profitClass = profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : 'profit-neutral';

        const imageSrc = product.image_path ? `/${product.image_path}` : 'https://via.placeholder.com/60x60?text=No+Image';

        // カテゴリーバッジを生成
        const categoryBadges = (product.categories || []).map(category =>
            `<span class="badge bg-secondary me-1">${category}</span>`
        ).join('');

        return `
            <tr>
                <td><img src="${imageSrc}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/60x60?text=No+Image'"></td>
                <td>${product.name}</td>
                <td>${categoryBadges || '<span class="text-muted">なし</span>'}</td>
                <td>${product.purchase_date}</td>
                <td>¥${product.purchase_price.toLocaleString()}</td>
                <td>¥${product.retail_price.toLocaleString()}</td>
                <td>¥${currentPrice.toLocaleString()}</td>
                <td><span class="${profitClass}">${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}</span></td>
                <td><span class="${profitClass}">${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%</span></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary" onclick="openEditModal(${product.id})">編集</button>
                        <button class="btn btn-danger" onclick="openSellModal(${product.id}, '${product.name}')">売却</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 商品登録
async function addProduct() {
    const name = document.getElementById('product-name').value;
    const purchaseDate = document.getElementById('purchase-date').value;
    const purchasePrice = document.getElementById('purchase-price').value;
    const retailPrice = document.getElementById('retail-price').value;
    const imageFile = document.getElementById('product-image').files[0];

    // カテゴリーの収集
    const categories = [];
    for (let i = 1; i <= 5; i++) {
        const categoryField = document.getElementById(`category${i}`);
        if (categoryField && categoryField.value.trim()) {
            categories.push(categoryField.value.trim());
        }
    }

    let imageData = null;
    if (imageFile) {
        imageData = await fileToBase64(imageFile);
    }

    try {
        const result = await eel.add_product(name, purchaseDate, purchasePrice, retailPrice, imageData, categories)();

        if (result.success) {
            showAlert('success', '商品を登録しました');
            document.getElementById('product-form').reset();
            document.getElementById('image-preview').innerHTML = '';
            // 今日の日付を再設定
            document.getElementById('purchase-date').value = new Date().toISOString().split('T')[0];
            // キャッシュ無効化
            invalidateCache('all');
            loadProductsWithCategories(); // 商品一覧とカテゴリーを更新
        } else {
            showAlert('error', '商品の登録に失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '商品の登録中にエラーが発生しました');
    }
}

// 画像プレビュー
function previewImage(file) {
    const previewDiv = document.getElementById('image-preview');

    if (!file) {
        previewDiv.innerHTML = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        previewDiv.innerHTML = `<div class="image-preview"><img src="${e.target.result}" alt="Preview"></div>`;
    };
    reader.readAsDataURL(file);
}

// ファイルをBase64に変換
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 市場価格更新用商品読み込み（最適化版）
async function loadProductsForPriceUpdate() {
    // キャッシュされた商品データを使用
    if (!currentProducts || currentProducts.length === 0) {
        await loadProducts();
    }

    const select = document.getElementById('price-product');
    if (!select) return;

    select.innerHTML = '<option value="">商品を選択してください</option>';

    currentProducts.forEach(product => {
        select.innerHTML += `<option value="${product.id}">${product.name}</option>`;
    });
}

// 市場価格履歴読み込み
async function loadPriceHistory() {
    const productId = document.getElementById('price-product').value;

    if (!productId) {
        document.getElementById('price-history').innerHTML = '';
        return;
    }

    try {
        const result = await eel.get_market_price_history(productId)();

        if (result.success) {
            displayPriceHistory(result.history);
        } else {
            document.getElementById('price-history').innerHTML = '<p class="text-muted">価格履歴がありません</p>';
        }
    } catch (error) {
        showAlert('error', '価格履歴の読み込み中にエラーが発生しました');
    }
}

// 価格履歴表示
function displayPriceHistory(history) {
    const historyDiv = document.getElementById('price-history');

    if (history.length === 0) {
        historyDiv.innerHTML = '<p class="text-muted">価格履歴がありません</p>';
        return;
    }

    const historyHTML = `
        <h5>価格履歴</h5>
        <div class="price-history">
            ${history.map(price => {
                // 日付部分のみを取得（時刻部分を除去）
                const dateOnly = price.price_date.split(' ')[0];
                return `
                <div class="price-history-item">
                    <div>
                        <span>${dateOnly}</span>
                        <strong>¥${price.price.toLocaleString()}</strong>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openPriceEditModal(${price.id}, '${dateOnly}', ${price.price})">編集</button>
                        <button class="btn btn-outline-danger" onclick="deletePriceEntry(${price.id})">削除</button>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;

    historyDiv.innerHTML = historyHTML;
}

// 市場価格更新
async function updateMarketPrice() {
    const productId = document.getElementById('price-product').value;
    const price = document.getElementById('market-price-value').value;
    const priceDate = document.getElementById('price-date').value;

    try {
        const result = await eel.add_market_price(productId, price, priceDate)();

        if (result.success) {
            showAlert('success', '市場価格を更新しました');
            document.getElementById('price-form').reset();
            document.getElementById('price-date').value = new Date().toISOString().split('T')[0];
            // キャッシュ無効化
            invalidateCache('all');
            loadPriceHistory();
            loadProducts(); // 商品一覧の価格も更新
            loadOutdatedProducts(); // 期限切れ商品リストも更新

            // ポートフォリオグラフも更新（現在の期間フィルタを維持）
            const activeButton = document.querySelector('#period-filter button.active');
            if (activeButton) {
                const buttonText = activeButton.textContent;
                if (buttonText === '1ヶ月') generatePortfolioChart(1);
                else if (buttonText === '3ヶ月') generatePortfolioChart(3);
                else if (buttonText === '6ヶ月') generatePortfolioChart(6);
                else if (buttonText === '1年') generatePortfolioChart(12);
                else generatePortfolioChart();
            } else {
                generatePortfolioChart();
            }
        } else {
            showAlert('error', '市場価格の更新に失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '市場価格の更新中にエラーが発生しました');
    }
}

// 未更新期間の閾値設定を保存
function saveOutdatedDaysThreshold() {
    const threshold = document.getElementById('outdated-days-threshold').value;
    localStorage.setItem('outdatedDaysThreshold', threshold);
    console.log('Outdated days threshold saved:', threshold);
}

// 未更新期間の閾値設定を読み込み
function loadOutdatedDaysThreshold() {
    const savedThreshold = localStorage.getItem('outdatedDaysThreshold');
    const thresholdInput = document.getElementById('outdated-days-threshold');

    if (savedThreshold && thresholdInput) {
        thresholdInput.value = savedThreshold;
        console.log('Outdated days threshold loaded:', savedThreshold);
    } else if (thresholdInput) {
        // デフォルト値は7日
        thresholdInput.value = 7;
    }
}

// 未更新期間の閾値を取得
function getOutdatedDaysThreshold() {
    const thresholdInput = document.getElementById('outdated-days-threshold');
    if (thresholdInput) {
        return parseInt(thresholdInput.value) || 7;
    }
    return 7; // デフォルト値
}

// 指定期間以上更新されていない商品を読み込み
async function loadOutdatedProducts() {
    try {
        const daysThreshold = getOutdatedDaysThreshold();
        const result = await eel.get_outdated_products(daysThreshold)();

        if (result.success) {
            displayOutdatedProducts(result.products);
        } else {
            document.getElementById('outdated-products-list').innerHTML =
                '<p class="text-muted">データの読み込みに失敗しました</p>';
        }
    } catch (error) {
        document.getElementById('outdated-products-list').innerHTML =
            '<p class="text-danger">エラーが発生しました</p>';
    }
}

// 期限切れ商品一覧表示
function displayOutdatedProducts(products) {
    const container = document.getElementById('outdated-products-list');
    const daysThreshold = getOutdatedDaysThreshold();

    if (products.length === 0) {
        container.innerHTML = `<p class="text-success"><i class="bi bi-check-circle"></i> すべての商品が${daysThreshold}日以内に更新されています</p>`;
        return;
    }

    const productsHTML = products.map(product => {
        const daysSince = product.days_since_update || 0;
        const lastUpdate = product.latest_price_date || product.purchase_date;
        const urgencyClass = daysSince >= 14 ? 'border-danger' : daysSince >= 10 ? 'border-warning' : 'border-info';
        const urgencyIcon = daysSince >= 14 ? 'exclamation-triangle-fill text-danger' :
                           daysSince >= 10 ? 'exclamation-triangle text-warning' :
                           'info-circle text-info';

        return `
            <div class="card mb-2 ${urgencyClass}">
                <div class="card-body py-2">
                    <div class="row align-items-center">
                        <div class="col-md-5">
                            <strong class="clickable-product-name"
                                    onclick="selectProductForPriceUpdate(${product.id}, '${product.name}')"
                                    style="cursor: pointer; color: #0066cc; text-decoration: underline;">
                                ${product.name}
                            </strong>
                        </div>
                        <div class="col-md-3">
                            <small class="text-muted">最終更新: ${lastUpdate}</small>
                        </div>
                        <div class="col-md-2">
                            <span class="${urgencyIcon.includes('danger') ? 'text-danger' : urgencyIcon.includes('warning') ? 'text-warning' : 'text-info'}">
                                <i class="bi bi-${urgencyIcon.split(' ')[0]}"></i> ${daysSince}日前
                            </span>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-sm btn-primary"
                                    onclick="selectProductForPriceUpdate(${product.id}, '${product.name}')">
                                更新
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="mb-3">
            <p class="text-warning mb-2">
                <i class="bi bi-clock"></i>
                ${products.length}件の商品が${daysThreshold}日以上価格更新されていません
            </p>
        </div>
        ${productsHTML}
    `;
}

// 商品を選択して価格更新フォームに設定
function selectProductForPriceUpdate(productId, productName) {
    // 商品選択ドロップダウンに設定
    const productSelect = document.getElementById('price-product');
    productSelect.value = productId;

    // 価格履歴を読み込み
    loadPriceHistory();

    // 今日の日付を設定
    document.getElementById('price-date').value = new Date().toISOString().split('T')[0];

    // 価格入力フィールドにフォーカス
    document.getElementById('market-price-value').focus();

    showAlert('success', `${productName} が選択されました。価格を入力してください。`);
}

// 期間フィルタボタンの状態を更新
function updatePeriodButtons(selectedPeriod) {
    const buttons = document.querySelectorAll('#period-filter button');

    buttons.forEach(button => {
        button.classList.remove('active');
        button.classList.remove('btn-secondary');
        button.classList.add('btn-outline-secondary');
    });

    // 選択されたボタンをアクティブにする
    let activeButton = null;
    if (selectedPeriod === 1) {
        activeButton = buttons[0]; // 1ヶ月
    } else if (selectedPeriod === 3) {
        activeButton = buttons[1]; // 3ヶ月
    } else if (selectedPeriod === 6) {
        activeButton = buttons[2]; // 6ヶ月
    } else if (selectedPeriod === 12) {
        activeButton = buttons[3]; // 1年
    } else {
        activeButton = buttons[4]; // 全期間
    }

    if (activeButton) {
        activeButton.classList.add('active');
        activeButton.classList.remove('btn-outline-secondary');
        activeButton.classList.add('btn-secondary');
    }
}

// グラフ用商品読み込み（最適化版）
async function loadProductsForChart() {
    // キャッシュされた商品データを使用
    if (!currentProducts || currentProducts.length === 0) {
        await loadProducts();
    }

    const select = document.getElementById('chart-product');
    if (!select) return;

    select.innerHTML = '<option value="">商品を選択してください</option>';

    currentProducts.forEach(product => {
        select.innerHTML += `<option value="${product.id}">${product.name}</option>`;
    });

    generatePortfolioChart();
}

// グローバル変数でチャートインスタンスを管理
let portfolioChart = null;
let productChart = null;
let categoryChart = null;

// ポートフォリオグラフ生成
async function generatePortfolioChart(periodMonths = null) {
    try {
        // ボタンの状態を更新
        updatePeriodButtons(periodMonths);

        const result = await eel.get_portfolio_chart_data(periodMonths)();

        if (result.success) {
            // 既存のチャートを破棄
            if (portfolioChart) {
                portfolioChart.destroy();
            }

            const ctx = document.getElementById('portfolio-chart').getContext('2d');
            portfolioChart = new Chart(ctx, {
                type: 'line',
                data: result.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'ポートフォリオ推移'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += '¥' + context.parsed.y.toLocaleString();
                                    return label;
                                },
                                afterLabel: function(context) {
                                    if (context.datasetIndex === 1) { // 現在価値累計の場合
                                        const purchaseValue = context.chart.data.datasets[0].data[context.dataIndex];
                                        const marketValue = context.parsed.y;
                                        const profit = marketValue - purchaseValue;
                                        const profitRate = purchaseValue > 0 ? (profit / purchaseValue * 100) : 0;
                                        return [
                                            `損益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}`,
                                            `利益率: ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%`
                                        ];
                                    }
                                    return null;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: '日付'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: '金額 (円)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        } else {
            document.getElementById('portfolio-chart').getContext('2d').canvas.style.display = 'none';
            const container = document.getElementById('portfolio-chart').parentNode;
            container.innerHTML = `<div class="text-danger">グラフの生成に失敗しました: ${result.error}</div>`;
        }
    } catch (error) {
        document.getElementById('portfolio-chart').getContext('2d').canvas.style.display = 'none';
        const container = document.getElementById('portfolio-chart').parentNode;
        container.innerHTML = '<div class="text-danger">グラフの生成中にエラーが発生しました</div>';
    }
}

// 個別商品グラフ生成
async function generateProductChart() {
    const productId = document.getElementById('chart-product').value;

    if (!productId) {
        // 既存のチャートを破棄
        if (productChart) {
            productChart.destroy();
            productChart = null;
        }
        const container = document.getElementById('product-chart').parentNode;
        container.innerHTML = '<canvas id="product-chart" width="800" height="400"></canvas><div class="text-muted mt-2">商品を選択してください</div>';
        return;
    }

    try {
        const result = await eel.get_product_chart_data(productId)();

        if (result.success) {
            // 既存のチャートを破棄
            if (productChart) {
                productChart.destroy();
            }

            const ctx = document.getElementById('product-chart').getContext('2d');

            // 購入価格の水平線を追加
            const purchasePriceData = result.data.labels.map(() => result.data.purchase_price);

            productChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: result.data.labels,
                    datasets: [
                        ...result.data.datasets,
                        {
                            label: `購入価格: ¥${result.data.purchase_price.toLocaleString()}`,
                            data: purchasePriceData,
                            borderColor: 'rgb(255, 99, 132)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            borderDash: [5, 5],
                            pointRadius: 0,
                            tension: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `${result.data.product_name} - 価格推移`
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += '¥' + context.parsed.y.toLocaleString();
                                    return label;
                                },
                                afterLabel: function(context) {
                                    if (context.datasetIndex === 0) { // 市場価格の場合
                                        const marketValue = context.parsed.y;
                                        const purchasePrice = result.data.purchase_price;
                                        const profit = marketValue - purchasePrice;
                                        const profitRate = purchasePrice > 0 ? (profit / purchasePrice * 100) : 0;
                                        return [
                                            `損益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}`,
                                            `利益率: ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%`
                                        ];
                                    }
                                    return null;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: '日付'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: '価格 (円)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        } else {
            document.getElementById('product-chart').getContext('2d').canvas.style.display = 'none';
            const container = document.getElementById('product-chart').parentNode;
            container.innerHTML = `<div class="text-danger">グラフの生成に失敗しました: ${result.error}</div>`;
        }
    } catch (error) {
        document.getElementById('product-chart').getContext('2d').canvas.style.display = 'none';
        const container = document.getElementById('product-chart').parentNode;
        container.innerHTML = '<div class="text-danger">グラフの生成中にエラーが発生しました</div>';
    }
}

// 売却モーダル表示
function openSellModal(productId, productName) {
    document.getElementById('sell-product-id').value = productId;
    document.getElementById('sell-product-name').textContent = productName;
    document.getElementById('sell-price').value = '';

    sellModal.show();
}

// 売却実行
async function confirmSell() {
    const productId = document.getElementById('sell-product-id').value;
    const sellPrice = document.getElementById('sell-price').value;
    const sellDate = document.getElementById('sell-date').value;

    try {
        const result = await eel.sell_product(productId, sellPrice, sellDate)();

        if (result.success) {
            showAlert('success', '商品を売却しました');
            // キャッシュ無効化
            invalidateCache('all');
            sellModal.hide();
            loadProducts();
            loadDashboard();
        } else {
            showAlert('error', '売却処理に失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '売却処理中にエラーが発生しました');
    }
}

// 売却済み商品読み込み
async function loadSoldProducts() {
    try {
        const result = await eel.get_sold_products()();

        if (result.success) {
            currentSoldProducts = result.products;
            displaySoldProducts(currentSoldProducts);
        } else {
            showAlert('error', '売却済み商品の読み込みに失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '売却済み商品の読み込み中にエラーが発生しました');
    }
}

// 売却済み商品表示
function displaySoldProducts(products) {
    const tbody = document.getElementById('sold-products-table');

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">売却済み商品がありません</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => {
        const profit = product.sold_price - product.purchase_price;
        const profitRate = product.purchase_price > 0 ? ((profit / product.purchase_price) * 100) : 0;
        const profitClass = profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : 'profit-neutral';

        return `
            <tr>
                <td>${product.name}</td>
                <td>${product.purchase_date}</td>
                <td>¥${product.purchase_price.toLocaleString()}</td>
                <td>${product.sold_date}</td>
                <td>¥${product.sold_price.toLocaleString()}</td>
                <td><span class="${profitClass}">${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}</span></td>
                <td><span class="${profitClass}">${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%</span></td>
            </tr>
        `;
    }).join('');
}

// 検索機能
async function searchProducts() {
    const searchTerm = document.getElementById('search-name').value;
    const dateFrom = document.getElementById('search-date-from').value;
    const dateTo = document.getElementById('search-date-to').value;

    try {
        const result = await eel.search_products(searchTerm || null, dateFrom || null, dateTo || null)();

        if (result.success) {
            currentProducts = result.products;
            displayProducts(currentProducts);
        } else {
            showAlert('error', '検索に失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '検索中にエラーが発生しました');
    }
}

// 検索クリア
function clearSearch() {
    document.getElementById('search-name').value = '';
    document.getElementById('search-date-from').value = '';
    document.getElementById('search-date-to').value = '';
    loadProducts();
}

// 損益詳細読み込み
async function loadProfitLossDetails() {
    try {
        const result = await eel.get_profit_loss_details()();

        if (result.success) {
            displayProfitLossDetails(result.details);
        } else {
            showAlert('error', '損益詳細の読み込みに失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '損益詳細の読み込み中にエラーが発生しました');
    }
}

// 損益詳細表示
function displayProfitLossDetails(details) {
    const tbody = document.getElementById('profit-loss-table');

    if (details.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = details.map(item => {
        const profit = item.status === 'holding' ? item.unrealized_profit : item.realized_profit;
        const profitClass = profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : 'profit-neutral';
        const statusClass = item.status === 'holding' ? 'badge bg-primary' : 'badge bg-success';
        const statusText = item.status === 'holding' ? '保有中' : '売却済み';

        return `
            <tr>
                <td>${item.name}</td>
                <td>${item.purchase_date}</td>
                <td>¥${item.purchase_price.toLocaleString()}</td>
                <td>¥${item.current_price.toLocaleString()}</td>
                <td><span class="${profitClass}">${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}</span></td>
                <td><span class="${profitClass}">${item.profit_rate >= 0 ? '+' : ''}${item.profit_rate.toFixed(2)}%</span></td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// アラート表示
function showAlert(type, message) {
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const alertHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    // 最初に表示されているタブにアラートを表示
    const activeTab = document.querySelector('.tab-content:not([style*="display: none"])');
    if (activeTab) {
        activeTab.insertAdjacentHTML('afterbegin', alertHTML);

        // 5秒後に自動で削除
        setTimeout(() => {
            const alert = activeTab.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
}

// 商品編集モーダル表示
async function openEditModal(productId) {
    try {
        // まずカテゴリー選択肢を読み込む
        await loadCategoryOptionsForAllSelects();

        const result = await eel.get_product_by_id(productId)();

        if (result.success && result.product) {
            const product = result.product;

            document.getElementById('edit-product-id').value = product.id;
            document.getElementById('edit-product-name').value = product.name;
            document.getElementById('edit-purchase-date').value = product.purchase_date;
            document.getElementById('edit-purchase-price').value = product.purchase_price;
            document.getElementById('edit-retail-price').value = product.retail_price;

            // カテゴリーの設定（選択肢が読み込まれた後に設定）
            const categories = product.categories || [];
            for (let i = 1; i <= 5; i++) {
                const categoryField = document.getElementById(`edit-category${i}`);
                if (categoryField) {
                    categoryField.value = categories[i-1] || '';
                }
            }

            editModal.show();
        } else {
            showAlert('error', '商品情報の取得に失敗しました: ' + (result.error || '商品が見つかりません'));
        }
    } catch (error) {
        showAlert('error', '商品情報の取得中にエラーが発生しました');
    }
}

// 商品編集実行
async function confirmEdit() {
    const productId = document.getElementById('edit-product-id').value;
    const name = document.getElementById('edit-product-name').value;
    const purchaseDate = document.getElementById('edit-purchase-date').value;
    const purchasePrice = document.getElementById('edit-purchase-price').value;
    const retailPrice = document.getElementById('edit-retail-price').value;

    console.log('DEBUG: confirmEdit called with:');
    console.log('  productId:', productId);
    console.log('  name:', name);
    console.log('  purchaseDate:', purchaseDate);
    console.log('  purchasePrice:', purchasePrice);
    console.log('  retailPrice:', retailPrice);

    // 必須フィールドのチェック
    if (!productId || !name || !purchaseDate || !purchasePrice || !retailPrice) {
        showAlert('error', '必須フィールドが入力されていません');
        return;
    }

    // カテゴリーの収集
    const categories = [];
    for (let i = 1; i <= 5; i++) {
        const categoryField = document.getElementById(`edit-category${i}`);
        console.log(`  edit-category${i}:`, categoryField ? categoryField.value : 'not found');
        if (categoryField && categoryField.value.trim()) {
            categories.push(categoryField.value.trim());
        }
    }
    console.log('  categories:', categories);

    try {
        console.log('Calling eel.update_product...');
        const result = await eel.update_product(productId, name, purchaseDate, purchasePrice, retailPrice, categories)();
        console.log('eel.update_product result:', result);

        if (result.success) {
            showAlert('success', '商品情報を更新しました');
            // キャッシュ無効化
            invalidateCache('all');
            editModal.hide();
            loadProductsWithCategories();
            loadDashboard();
        } else {
            showAlert('error', '商品の更新に失敗しました: ' + (result.error || 'unknown error'));
        }
    } catch (error) {
        console.error('Error in confirmEdit:', error);
        showAlert('error', '商品の更新中にエラーが発生しました: ' + error.message);
    }
}

// 過去商品参照モーダル表示
async function showPastProducts() {
    try {
        // 売却済み商品と現在の商品を両方取得
        const soldResult = await eel.get_sold_products()();
        const currentResult = await eel.get_products()();

        if (soldResult.success && currentResult.success) {
            const allProducts = [...soldResult.products, ...currentResult.products];
            displayPastProductsList(allProducts);
            pastProductsModal.show();
        } else {
            showAlert('error', '過去商品データの読み込みに失敗しました');
        }
    } catch (error) {
        showAlert('error', '過去商品データの読み込み中にエラーが発生しました');
    }
}

// 過去商品一覧表示
function displayPastProductsList(products) {
    const tbody = document.getElementById('past-products-table');

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">商品がありません</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => {
        const imageSrc = product.image_path ? `/${product.image_path}` : 'https://via.placeholder.com/40x40?text=No+Image';
        const status = product.is_sold ? '売却済み' : '保有中';
        const statusClass = product.is_sold ? 'badge bg-success' : 'badge bg-primary';

        // カテゴリーバッジを生成
        const categoryBadges = (product.categories || []).map(category =>
            `<span class="badge bg-secondary me-1" style="font-size: 0.7em;">${category}</span>`
        ).join('');

        return `
            <tr>
                <td><img src="${imageSrc}" alt="${product.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.src='https://via.placeholder.com/40x40?text=No+Image'"></td>
                <td>${product.name}</td>
                <td>${categoryBadges || '<span class="text-muted">なし</span>'}</td>
                <td>${product.purchase_date}</td>
                <td>¥${product.purchase_price.toLocaleString()}</td>
                <td><span class="${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="selectPastProduct(${product.id})">選択</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 過去商品を選択して登録フォームに反映
async function selectPastProduct(productId) {
    try {
        // 売却済み商品から探す
        const soldResult = await eel.get_sold_products()();
        let selectedProduct = null;

        if (soldResult.success) {
            selectedProduct = soldResult.products.find(p => p.id === productId);
        }

        // 見つからない場合は現在の商品から探す
        if (!selectedProduct) {
            const currentResult = await eel.get_products()();
            if (currentResult.success) {
                selectedProduct = currentResult.products.find(p => p.id === productId);
            }
        }

        if (selectedProduct) {
            // カテゴリー選択肢を最新に更新
            await loadCategoryOptionsForAllSelects();

            // 登録フォームに商品データを設定
            document.getElementById('product-name').value = selectedProduct.name;
            document.getElementById('purchase-price').value = selectedProduct.purchase_price;
            document.getElementById('retail-price').value = selectedProduct.retail_price;

            // カテゴリーの設定
            const categories = selectedProduct.categories || [];
            for (let i = 1; i <= 5; i++) {
                const categoryField = document.getElementById(`category${i}`);
                if (categoryField) {
                    categoryField.value = categories[i-1] || '';
                }
            }

            // 今日の日付を購入日に設定
            document.getElementById('purchase-date').value = new Date().toISOString().split('T')[0];

            pastProductsModal.hide();
            showAlert('success', '過去商品データを登録フォームに反映しました');

            // 商品登録タブに切り替え
            showTab('add-product', document.querySelector('.nav-link[onclick*="add-product"]'));
        } else {
            showAlert('error', '選択された商品が見つかりません');
        }
    } catch (error) {
        showAlert('error', '商品データの取得中にエラーが発生しました');
    }
}

// 価格編集モーダル表示
function openPriceEditModal(priceId, priceDate, price) {
    document.getElementById('price-edit-id').value = priceId;
    document.getElementById('price-edit-date').value = priceDate;
    document.getElementById('price-edit-value').value = price;

    priceEditModal.show();
}

// 価格編集実行
async function confirmPriceEdit() {
    const priceId = document.getElementById('price-edit-id').value;
    const priceDate = document.getElementById('price-edit-date').value;
    const price = document.getElementById('price-edit-value').value;

    try {
        const result = await eel.update_market_price(priceId, price, priceDate)();

        if (result.success) {
            showAlert('success', '市場価格を更新しました');
            // キャッシュ無効化
            invalidateCache('all');
            priceEditModal.hide();
            loadPriceHistory();
            loadProducts(); // 商品一覧の価格も更新
        } else {
            showAlert('error', '市場価格の更新に失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '市場価格の更新中にエラーが発生しました');
    }
}

// 価格履歴削除
async function deletePriceEntry(priceId) {
    if (!confirm('この価格履歴を削除しますか？')) {
        return;
    }

    try {
        const result = await eel.delete_market_price(priceId)();

        if (result.success) {
            showAlert('success', '価格履歴を削除しました');
            // キャッシュ無効化
            invalidateCache('all');
            loadPriceHistory();
            loadProducts(); // 商品一覧の価格も更新
        } else {
            showAlert('error', '価格履歴の削除に失敗しました: ' + result.error);
        }
    } catch (error) {
        showAlert('error', '価格履歴の削除中にエラーが発生しました');
    }
}

// カテゴリーフィルタとソート機能
function filterAndSortProducts() {
    const categoryFilter = document.getElementById('category-filter').value;
    const sortBy = document.getElementById('sort-by').value;
    const sortOrder = document.getElementById('sort-order').value;

    let filteredProducts = [...currentProducts];

    // カテゴリーフィルタ
    if (categoryFilter) {
        filteredProducts = filteredProducts.filter(product => {
            const categories = product.categories || [];
            return categories.some(category => category.toLowerCase().includes(categoryFilter.toLowerCase()));
        });
    }

    // ソート
    filteredProducts.sort((a, b) => {
        let valueA, valueB;

        switch (sortBy) {
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 'purchase_date':
                valueA = new Date(a.purchase_date);
                valueB = new Date(b.purchase_date);
                break;
            case 'purchase_price':
                valueA = a.purchase_price;
                valueB = b.purchase_price;
                break;
            case 'current_price':
                valueA = a.latest_market_price || a.purchase_price;
                valueB = b.latest_market_price || b.purchase_price;
                break;
            case 'profit':
                valueA = (a.latest_market_price || a.purchase_price) - a.purchase_price;
                valueB = (b.latest_market_price || b.purchase_price) - b.purchase_price;
                break;
            case 'profit_rate':
                valueA = a.purchase_price > 0 ? (((a.latest_market_price || a.purchase_price) - a.purchase_price) / a.purchase_price) * 100 : 0;
                valueB = b.purchase_price > 0 ? (((b.latest_market_price || b.purchase_price) - b.purchase_price) / b.purchase_price) * 100 : 0;
                break;
            default:
                return 0;
        }

        if (sortOrder === 'desc') {
            return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
        } else {
            return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        }
    });

    displayProducts(filteredProducts);
}

// カテゴリー候補をロードして選択肢に追加（キャッシュ対応）
async function loadCategoryOptions() {
    try {
        const now = Date.now();

        // カテゴリーデータの取得（キャッシュから）
        let categories;
        if (categoriesCache && cacheTimestamp.categories && (now - cacheTimestamp.categories < CACHE_DURATION)) {
            categories = categoriesCache;
        } else {
            const result = await eel.get_all_categories()();
            if (result.success) {
                categoriesCache = result.categories;
                cacheTimestamp.categories = now;
                categories = result.categories;
            } else {
                return;
            }
        }

        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;

        const currentValue = categoryFilter.value;

        // 既存のオプション（最初の空オプション以外）をクリア
        while (categoryFilter.children.length > 1) {
            categoryFilter.removeChild(categoryFilter.lastChild);
        }

        // カテゴリーを選択肢に追加
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });

        // 値を復元
        if (currentValue) {
            categoryFilter.value = currentValue;
        }
    } catch (error) {
        console.error('カテゴリー候補の読み込み中にエラーが発生しました:', error);
    }
}

// 商品一覧読み込み時にカテゴリー候補も更新
async function loadProductsWithCategories() {
    await loadProducts();
    await loadCategoryOptions();
}

// フィルタ・ソートのリセット
function resetFiltersAndSort() {
    document.getElementById('category-filter').value = '';
    document.getElementById('sort-by').value = 'purchase_date';
    document.getElementById('sort-order').value = 'desc';
    displayProducts(currentProducts);
}

// カテゴリー管理
async function loadCategoryManagement() {
    try {
        const result = await eel.get_all_categories()();
        if (result.success) {
            displayCategoriesList(result.categories);
        }
    } catch (error) {
        showAlert('error', 'カテゴリーの読み込み中にエラーが発生しました');
    }
}

function displayCategoriesList(categories) {
    const container = document.getElementById('categories-list');

    if (categories.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">登録されているカテゴリーがありません</p></div>';
        return;
    }

    container.innerHTML = categories.map(category => `
        <div class="col-md-4 col-sm-6 mb-3">
            <div class="card">
                <div class="card-body d-flex justify-content-between align-items-center">
                    <span class="badge bg-primary">${category}</span>
                    <button class="btn btn-danger btn-sm" onclick="deleteCategoryItem('${category}')">削除</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function addNewCategory() {
    const categoryName = document.getElementById('new-category-name').value.trim();

    if (!categoryName) {
        showAlert('error', 'カテゴリー名を入力してください');
        return;
    }

    try {
        const result = await eel.add_category(categoryName)();

        if (result.success) {
            showAlert('success', 'カテゴリーを追加しました');
            // キャッシュ無効化
            invalidateCache('categories');
            document.getElementById('new-category-name').value = '';
            loadCategoryManagement();
            loadCategoryOptionsForAllSelects();
        } else {
            showAlert('error', 'カテゴリーの追加に失敗しました（既に存在する可能性があります）');
        }
    } catch (error) {
        showAlert('error', 'カテゴリーの追加中にエラーが発生しました');
    }
}

async function deleteCategoryItem(categoryName) {
    if (!confirm(`カテゴリー「${categoryName}」を削除しますか？`)) {
        return;
    }

    try {
        const result = await eel.delete_category(categoryName)();

        if (result.success) {
            showAlert('success', 'カテゴリーを削除しました');
            // キャッシュ無効化
            invalidateCache('categories');
            loadCategoryManagement();
            loadCategoryOptionsForAllSelects();
        } else {
            showAlert('error', 'カテゴリーの削除に失敗しました');
        }
    } catch (error) {
        showAlert('error', 'カテゴリーの削除中にエラーが発生しました');
    }
}

// 全てのカテゴリープルダウンに選択肢を設定
async function loadCategoryOptionsForAllSelects() {
    try {
        const result = await eel.get_all_categories()();

        if (result.success) {
            // 商品登録フォーム
            for (let i = 1; i <= 5; i++) {
                updateSelectOptions(`category${i}`, result.categories);
            }

            // 商品編集フォーム
            for (let i = 1; i <= 5; i++) {
                updateSelectOptions(`edit-category${i}`, result.categories);
            }
        }
    } catch (error) {
        console.error('カテゴリー選択肢の読み込み中にエラーが発生しました:', error);
    }
}

function updateSelectOptions(selectId, categories) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;

    // 最初のオプション（空白）以外をクリア
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    // カテゴリーを選択肢に追加
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });

    // 値を復元
    if (currentValue) {
        select.value = currentValue;
    }
}

// カテゴリー分析を読み込み
async function loadCategoryAnalysis() {
    try {
        const result = await eel.get_category_analysis()();

        if (result.success) {
            displayCategoryAnalysis(result.analysis);
        } else {
            document.getElementById('category-analysis-table').innerHTML =
                '<tr><td colspan="8" class="text-center">データの読み込みに失敗しました</td></tr>';
        }
    } catch (error) {
        showAlert('error', 'カテゴリー分析の読み込み中にエラーが発生しました');
    }
}

// カテゴリー分析テーブル表示
function displayCategoryAnalysis(analysis) {
    const tbody = document.getElementById('category-analysis-table');

    if (!analysis || Object.keys(analysis).length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">カテゴリーデータがありません</td></tr>';
        return;
    }

    tbody.innerHTML = Object.entries(analysis).map(([category, data]) => {
        const profitClass = data.unrealized_profit >= 0 ? 'text-success' : 'text-danger';
        const avgProfitClass = data.avg_realized_profit >= 0 ? 'text-success' : 'text-danger';

        return `
            <tr>
                <td><span class="badge bg-primary">${category}</span></td>
                <td>${data.holding_count}</td>
                <td>¥${data.total_purchase.toLocaleString()}</td>
                <td>¥${data.total_market_value.toLocaleString()}</td>
                <td><span class="${profitClass}">${data.unrealized_profit >= 0 ? '+' : ''}¥${data.unrealized_profit.toLocaleString()}</span></td>
                <td>${data.sold_count}</td>
                <td><span class="${avgProfitClass}">¥${Math.round(data.avg_realized_profit || 0).toLocaleString()}</span></td>
                <td>${data.total_items}</td>
            </tr>
        `;
    }).join('');
}

// カテゴリー別グラフ生成
async function generateCategoryChart() {
    try {
        const result = await eel.get_category_chart_data()();

        if (result.success) {
            // 既存のチャートを破棄
            if (categoryChart) {
                categoryChart.destroy();
            }

            const ctx = document.getElementById('category-chart').getContext('2d');
            categoryChart = new Chart(ctx, {
                type: 'bar',
                data: result.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'カテゴリー別投資分析'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += '¥' + context.parsed.y.toLocaleString();
                                    return label;
                                },
                                afterLabel: function(context) {
                                    if (context.datasetIndex === 1) { // 現在価値の場合
                                        const categoryIndex = context.dataIndex;
                                        const investmentValue = context.chart.data.datasets[0].data[categoryIndex];
                                        const marketValue = context.parsed.y;
                                        const profit = marketValue - investmentValue;
                                        const profitRate = investmentValue > 0 ? (profit / investmentValue * 100) : 0;
                                        return [
                                            `カテゴリー: ${context.chart.data.labels[categoryIndex]}`,
                                            `損益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}`,
                                            `利益率: ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%`
                                        ];
                                    } else if (context.datasetIndex === 0) { // 投資額の場合
                                        return `カテゴリー: ${context.chart.data.labels[context.dataIndex]}`;
                                    }
                                    return null;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'カテゴリー'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: '金額 (円)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        } else {
            document.getElementById('category-chart').getContext('2d').canvas.style.display = 'none';
            const container = document.getElementById('category-chart').parentNode;
            container.innerHTML = `<div class="text-danger">グラフの生成に失敗しました: ${result.error}</div>`;
        }
    } catch (error) {
        document.getElementById('category-chart').getContext('2d').canvas.style.display = 'none';
        const container = document.getElementById('category-chart').parentNode;
        container.innerHTML = '<div class="text-danger">グラフの生成中にエラーが発生しました</div>';
    }
}

// ボールアニメーション遊び要素
function playBallAnimation(value) {
    // アニメーション実行中は重複を防ぐ
    if (document.querySelector('.ball-animation-container')) {
        return;
    }

    // ランダムにボールの種類を選択
    const ballTypes = ['monster-ball', 'master-ball', 'super-ball', 'hyper-ball'];
    const selectedBall = ballTypes[Math.floor(Math.random() * ballTypes.length)];

    // アニメーションコンテナを作成
    const container = document.createElement('div');
    container.className = 'ball-animation-container';
    document.body.appendChild(container);

    // ボールを作成
    const ball = document.createElement('div');
    ball.className = `animated-ball ${selectedBall} ball-entrance`;

    // ボールを画面中央に配置
    ball.style.left = '50%';
    ball.style.transform = 'translateX(-50%)';
    ball.style.bottom = '-100px';

    container.appendChild(ball);

    // キラキラエフェクトを生成
    function createSparkles() {
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle-effect';

                // ランダムな位置に配置
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const radius = 100;
                const angle = (i * 30) + Math.random() * 30;
                const x = centerX + Math.cos(angle * Math.PI / 180) * radius;
                const y = centerY + Math.sin(angle * Math.PI / 180) * radius;

                sparkle.style.left = x + 'px';
                sparkle.style.top = y + 'px';

                container.appendChild(sparkle);

                // キラキラを削除
                setTimeout(() => {
                    if (sparkle.parentNode) {
                        sparkle.parentNode.removeChild(sparkle);
                    }
                }, 1000);
            }, i * 50);
        }
    }

    // ボール登場後の処理
    setTimeout(() => {
        // ボールオープンアニメーション
        ball.className = `animated-ball ${selectedBall} ball-opening`;

        // キラキラエフェクト開始
        createSparkles();

        // 数字を表示
        setTimeout(() => {
            const number = document.createElement('div');
            number.className = 'animated-number';
            number.textContent = '¥' + value;

            // 画面中央に配置
            number.style.left = '50%';
            number.style.top = '50%';
            number.style.transform = 'translate(-50%, -50%)';

            container.appendChild(number);

            // 数字を削除
            setTimeout(() => {
                if (number.parentNode) {
                    number.parentNode.removeChild(number);
                }
            }, 2000);
        }, 500);

        // ボールを削除
        setTimeout(() => {
            if (ball.parentNode) {
                ball.parentNode.removeChild(ball);
            }
        }, 1000);
    }, 1500);

    // 全体のクリーンアップ
    setTimeout(() => {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }, 4000);
}

// 利益マイルストーン達成チェック
function checkProfitMilestones(currentProfit) {
    const previousProfit = localStorage.getItem('previousTotalProfit') || '0';
    const prevProfitNum = parseInt(previousProfit);

    // 現在の利益を保存
    localStorage.setItem('previousTotalProfit', currentProfit.toString());

    // 初回起動時は演出しない
    if (previousProfit === '0') {
        return;
    }

    // マイルストーンを定義（円単位）
    const milestones = [
        { amount: 10000, name: '1万円', level: 1 },
        { amount: 50000, name: '5万円', level: 2 },
        { amount: 100000, name: '10万円', level: 3 },
        { amount: 200000, name: '20万円', level: 3 },
        { amount: 500000, name: '50万円', level: 3 },
        { amount: 1000000, name: '100万円', level: 3 }
    ];

    // 達成したマイルストーンをチェック
    for (const milestone of milestones) {
        if (prevProfitNum < milestone.amount && currentProfit >= milestone.amount) {
            // 少し遅らせて演出を開始（データ表示後）
            setTimeout(() => {
                playMilestoneCelebration(milestone);
            }, 1000);
            break; // 一度に1つのマイルストーンのみ
        }
    }
}

// マイルストーン達成お祝い演出
function playMilestoneCelebration(milestone) {
    // アニメーション実行中は重複を防ぐ
    if (document.querySelector('.milestone-celebration-container')) {
        return;
    }

    // 演出コンテナを作成
    const container = document.createElement('div');
    container.className = 'milestone-celebration-container';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
    `;
    document.body.appendChild(container);

    // フェードイン
    setTimeout(() => {
        container.style.opacity = '1';
    }, 100);

    if (milestone.level === 1) {
        // 1万円レベル：ピカチュウ風演出
        createPikachuCelebration(container, milestone);
    } else if (milestone.level === 2) {
        // 5万円レベル：進化演出風
        createEvolutionCelebration(container, milestone);
    } else if (milestone.level === 3) {
        // 10万円以上：伝説ポケモン風
        createLegendaryCelebration(container, milestone);
    }

    // 演出終了後のクリーンアップ
    setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 500);
    }, 5000);
}

// ピカチュウ風お祝い演出（1万円レベル）
function createPikachuCelebration(container, milestone) {
    const content = document.createElement('div');
    content.style.cssText = `
        text-align: center;
        color: white;
        animation: bounceIn 1s ease-out;
    `;

    content.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 20px;">⚡</div>
        <div style="font-size: 2.5rem; font-weight: bold; color: #ffff00; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); margin-bottom: 10px;">
            おめでとう！
        </div>
        <div style="font-size: 1.8rem; color: #ffffff; margin-bottom: 20px;">
            ${milestone.name}の利益を達成しました！
        </div>
        <div style="font-size: 1.2rem; color: #ffdd00;">
            ⚡ 電撃的な成果です！ ⚡
        </div>
    `;

    container.appendChild(content);

    // 電撃エフェクト
    createLightningEffects(container);

    // モンスターボール3個演出
    setTimeout(() => {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                createCelebrationBall(container, i);
            }, i * 300);
        }
    }, 1000);
}

// 進化風お祝い演出（5万円レベル）
function createEvolutionCelebration(container, milestone) {
    const content = document.createElement('div');
    content.style.cssText = `
        text-align: center;
        color: white;
        animation: pulse 1.5s ease-in-out;
    `;

    content.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 20px;">✨</div>
        <div style="font-size: 2.5rem; font-weight: bold; background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); margin-bottom: 10px;">
            レベルアップ！
        </div>
        <div style="font-size: 1.8rem; color: #ffffff; margin-bottom: 20px;">
            ${milestone.name}の利益を達成！
        </div>
        <div style="font-size: 1.2rem; color: #4ecdc4;">
            🌟 投資スキルが向上しました！ 🌟
        </div>
    `;

    container.appendChild(content);

    // 虹色オーラエフェクト
    createRainbowAura(container);

    // 進化の光エフェクト
    createEvolutionLight(container);
}

// 伝説ポケモン風お祝い演出（10万円以上）
function createLegendaryCelebration(container, milestone) {
    const content = document.createElement('div');
    content.style.cssText = `
        text-align: center;
        color: white;
        animation: legendaryAppear 2s ease-out;
    `;

    content.innerHTML = `
        <div style="font-size: 5rem; margin-bottom: 20px;">👑</div>
        <div style="font-size: 3rem; font-weight: bold; background: linear-gradient(45deg, #ffd700, #ffed4e, #ffd700); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 20px rgba(255, 215, 0, 0.8); margin-bottom: 10px; animation: goldGlow 2s ease-in-out infinite;">
            伝説の投資家！
        </div>
        <div style="font-size: 2rem; color: #ffffff; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
            ${milestone.name}の利益を達成！
        </div>
        <div style="font-size: 1.4rem; color: #ffd700;">
            ⭐ 真のポケモンマスター！ ⭐
        </div>
    `;

    container.appendChild(content);

    // 星降りエフェクト
    createStarRain(container);

    // 全画面光エフェクト
    createLegendaryLight(container);
}

// 各種エフェクト生成関数
function createLightningEffects(container) {
    for (let i = 0; i < 8; i++) {
        const lightning = document.createElement('div');
        lightning.style.cssText = `
            position: absolute;
            width: 4px;
            height: 60px;
            background: linear-gradient(to bottom, #ffff00, transparent);
            animation: lightning ${0.5 + Math.random() * 0.5}s ease-out;
            top: ${20 + Math.random() * 60}%;
            left: ${10 + Math.random() * 80}%;
            transform-origin: top center;
            transform: rotate(${-30 + Math.random() * 60}deg);
        `;
        container.appendChild(lightning);

        setTimeout(() => {
            if (lightning.parentNode) {
                lightning.parentNode.removeChild(lightning);
            }
        }, 1000);
    }
}

function createCelebrationBall(container, index) {
    const ball = document.createElement('div');
    ball.style.cssText = `
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(to bottom, #ff4444 50%, #ffffff 50%);
        border: 2px solid #333;
        top: 60%;
        left: ${40 + index * 10}%;
        animation: ballBounce 1s ease-out;
    `;
    container.appendChild(ball);

    setTimeout(() => {
        if (ball.parentNode) {
            ball.parentNode.removeChild(ball);
        }
    }, 1500);
}

function createRainbowAura(container) {
    const aura = document.createElement('div');
    aura.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        height: 300px;
        border-radius: 50%;
        background: conic-gradient(#ff6b6b, #4ecdc4, #45b7d1, #f9ca24, #ff6b6b);
        animation: rotate 3s linear infinite;
        opacity: 0.6;
        z-index: -1;
    `;
    container.appendChild(aura);
}

function createEvolutionLight(container) {
    const light = document.createElement('div');
    light.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%);
        animation: pulse 2s ease-in-out infinite;
        z-index: -1;
    `;
    container.appendChild(light);
}

function createStarRain(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            star.style.cssText = `
                position: absolute;
                font-size: 1.5rem;
                color: #ffd700;
                top: -20px;
                left: ${Math.random() * 100}%;
                animation: starFall 3s linear;
                z-index: -1;
            `;
            star.textContent = '⭐';
            container.appendChild(star);

            setTimeout(() => {
                if (star.parentNode) {
                    star.parentNode.removeChild(star);
                }
            }, 3000);
        }, i * 100);
    }
}

function createLegendaryLight(container) {
    const light = document.createElement('div');
    light.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(255,215,0,0.3) 0%, transparent 70%);
        animation: legendaryPulse 3s ease-in-out infinite;
        z-index: -2;
    `;
    container.appendChild(light);
}