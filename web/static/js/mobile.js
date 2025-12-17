// モバイル専用JavaScript - Flask REST API版

// ================== API Helper Functions ==================
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

async function apiGet(endpoint) {
    return await apiRequest(endpoint, { method: 'GET' });
}

async function apiPost(endpoint, data) {
    return await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function apiPut(endpoint, data) {
    return await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function apiDelete(endpoint) {
    return await apiRequest(endpoint, { method: 'DELETE' });
}

// ================== Tab Management ==================
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
    } else if (tabId === 'sold-products') {
        loadSoldProductsMobile();
    }
}

// ================== Dashboard ==================
// ダッシュボード読み込み
async function loadDashboardMobile() {
    try {
        const result = await apiGet('/api/portfolio/summary');

        console.log('Portfolio summary result:', result);

        if (result && result.success && result.summary) {
            const summary = result.summary;

            const html = `
                <div class="summary-card">
                    <h3>総投資額</h3>
                    <div class="value">¥${(summary.total_purchase || 0).toLocaleString()}</div>
                </div>
                <div class="summary-card">
                    <h3>現在価値</h3>
                    <div class="value">¥${(summary.total_market_value || 0).toLocaleString()}</div>
                    <div class="change ${(summary.unrealized_profit || 0) >= 0 ? 'positive' : 'negative'}">
                        含み損益: ${(summary.unrealized_profit || 0) >= 0 ? '+' : ''}¥${(summary.unrealized_profit || 0).toLocaleString()}
                    </div>
                </div>
                <div class="summary-card">
                    <h3>総損益</h3>
                    <div class="value ${(summary.total_profit || 0) >= 0 ? 'positive' : 'negative'}">
                        ${(summary.total_profit || 0) >= 0 ? '+' : ''}¥${(summary.total_profit || 0).toLocaleString()}
                    </div>
                    <div class="change">
                        実現損益: ¥${(summary.realized_profit || 0).toLocaleString()}
                    </div>
                </div>
                <div class="summary-card">
                    <h3>保有商品</h3>
                    <div class="value">${summary.holding_count || 0}点</div>
                    <div class="change">売却済み: ${summary.sold_count || 0}点</div>
                </div>
                <div class="summary-card">
                    <h3>パフォーマンス</h3>
                    <div class="product-info">
                        ROI (保有): <span class="${(summary.roi || 0) >= 0 ? 'text-success' : 'text-danger'}">${(summary.roi || 0).toFixed(2)}%</span>
                    </div>
                    <div class="product-info">
                        総合ROI: <span class="${(summary.total_roi || 0) >= 0 ? 'text-success' : 'text-danger'}">${(summary.total_roi || 0).toFixed(2)}%</span>
                    </div>
                </div>
            `;

            document.getElementById('summary-cards-mobile').innerHTML = html;

            // チャート描画
            loadPortfolioChartMobile();
        } else {
            console.error('Invalid result:', result);
            document.getElementById('summary-cards-mobile').innerHTML = '<div class="loading">データの読み込みに失敗しました</div>';
        }
    } catch (error) {
        console.error('ダッシュボード読み込みエラー:', error);
        console.error('Error stack:', error.stack);
        document.getElementById('summary-cards-mobile').innerHTML = `<div class="loading">エラーが発生しました: ${error.message}</div>`;
    }
}

// グローバル変数でチャートインスタンスを保持
let portfolioChartInstance = null;

// ポートフォリオチャート読み込み
async function loadPortfolioChartMobile() {
    try {
        const result = await apiGet('/api/portfolio/chart-data');

        const chartContainer = document.getElementById('portfolio-chart-container');
        const ctx = document.getElementById('portfolio-chart-mobile');

        if (result.success && result.data && result.data.labels && result.data.labels.length > 0) {
            // チャートコンテナを表示
            if (chartContainer) {
                chartContainer.style.display = 'block';
            }

            if (ctx) {
                // 既存のチャートを破棄
                if (portfolioChartInstance) {
                    portfolioChartInstance.destroy();
                }

                // 新しいチャートを作成
                portfolioChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: result.data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    font: {
                                        size: 10
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    font: {
                                        size: 10
                                    },
                                    callback: function(value) {
                                        return '¥' + value.toLocaleString();
                                    }
                                }
                            },
                            x: {
                                ticks: {
                                    font: {
                                        size: 9
                                    },
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            }
                        }
                    }
                });
            }
        } else {
            // データがない場合はチャートを非表示にしてメッセージを表示
            if (chartContainer) {
                chartContainer.style.display = 'none';
            }
            console.log('チャートデータがありません');
        }
    } catch (error) {
        console.error('チャート読み込みエラー:', error);
        const chartContainer = document.getElementById('portfolio-chart-container');
        if (chartContainer) {
            chartContainer.style.display = 'none';
        }
    }
}

// ================== Products List ==================
// 商品一覧読み込み
async function loadProductsMobile() {
    try {
        const searchTerm = document.getElementById('search-name-mobile').value;
        const endpoint = searchTerm ? `/api/products/search?query=${encodeURIComponent(searchTerm)}` : '/api/products';
        const result = await apiGet(endpoint);

        if (result.success) {
            const products = result.products;
            let html = '';

            products.forEach(product => {
                const currentPrice = product.latest_market_price || product.purchase_price;
                const profit = currentPrice - product.purchase_price;
                const profitClass = profit >= 0 ? 'text-success' : 'text-danger';
                const productName = (product.name || '').replace(/'/g, "\\'");

                html += `
                    <div class="product-card">
                        <div class="product-name" onclick="showProductDetailMobile(${product.id})" style="cursor: pointer; color: #667eea;">
                            ${product.name} <i class="bi bi-chevron-right" style="font-size: 12px;"></i>
                        </div>
                        <div class="product-info">購入日: ${product.purchase_date}</div>
                        <div class="product-info">購入価格: ¥${product.purchase_price.toLocaleString()}</div>
                        <div class="product-info">現在価格: ¥${currentPrice.toLocaleString()}</div>
                        <div class="product-profit ${profitClass}">
                            損益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}
                        </div>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-primary me-1" onclick="editProductMobile(${product.id})">
                                <i class="bi bi-pencil"></i> 編集
                            </button>
                            <button class="btn btn-sm btn-success me-1" onclick="sellProductMobile(${product.id}, '${productName}')">
                                <i class="bi bi-cash"></i> 売却
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProductMobile(${product.id}, '${productName}')">
                                <i class="bi bi-trash"></i> 削除
                            </button>
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

// ================== Product Form ==================
// 商品登録フォーム用カテゴリー読み込み
async function loadCategoriesForFormMobile() {
    try {
        const result = await apiGet('/api/categories');

        if (result.success) {
            const select = document.getElementById('category1-mobile');
            select.innerHTML = '<option value="">カテゴリーを選択</option>';

            result.categories.forEach(cat => {
                select.innerHTML += `<option value="${cat}">${cat}</option>`;
            });

            // 購入日に今日の日付を設定
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('purchase-date-mobile').value = today;
        }
    } catch (error) {
        console.error('カテゴリー読み込みエラー:', error);
    }
}

// ================== Market Price Update ==================
// 市場価格更新用商品読み込み
let allProductsForPrice = [];

async function loadProductsForMarketPriceMobile() {
    try {
        const result = await apiGet('/api/products');

        if (result.success) {
            allProductsForPrice = result.products;
            const select = document.getElementById('select-product-mobile');
            select.innerHTML = '<option value="">商品を選択してください</option>';

            result.products.forEach(product => {
                select.innerHTML += `<option value="${product.id}">${product.name}</option>`;
            });

            // 日付フィールドに今日の日付を設定
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('market-price-date-mobile').value = today;

            // 更新されていない商品を自動で検索
            loadOutdatedProductsMobile();
        }
    } catch (error) {
        console.error('商品読み込みエラー:', error);
    }
}

// 更新されていない商品を読み込み
async function loadOutdatedProductsMobile() {
    try {
        const daysThreshold = parseInt(document.getElementById('outdated-days-mobile').value) || 7;
        console.log('Loading outdated products with threshold:', daysThreshold);

        const result = await apiGet(`/api/products/outdated?days_threshold=${daysThreshold}`);
        console.log('Outdated products result:', result);

        const container = document.getElementById('outdated-products-list-mobile');

        if (!container) {
            console.error('Container not found: outdated-products-list-mobile');
            return;
        }

        if (result && result.success && result.products && result.products.length > 0) {
            let html = '<div class="list-group mt-2">';
            result.products.forEach(product => {
                const daysSince = Math.floor(product.days_since_update || 0);
                const productName = (product.name || '不明').replace(/'/g, "\\'");
                html += `
                    <div class="list-group-item" onclick="selectProductForUpdate(${product.id}, '${productName}')" style="cursor: pointer;">
                        <div class="d-flex justify-content-between">
                            <strong>${product.name || '不明'}</strong>
                            <span class="badge bg-warning">${daysSince}日前</span>
                        </div>
                        <small class="text-muted">現在価格: ¥${(product.latest_market_price || product.purchase_price || 0).toLocaleString()}</small>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            const message = result && result.error ? result.error : '更新が必要な商品はありません';
            container.innerHTML = `<p class="text-muted mt-2">${message}</p>`;
        }
    } catch (error) {
        console.error('更新が必要な商品の読み込みエラー:', error);
        console.error('Error stack:', error.stack);
        const container = document.getElementById('outdated-products-list-mobile');
        if (container) {
            container.innerHTML = `<p class="text-danger mt-2">エラーが発生しました: ${error.message}</p>`;
        }
    }
}

// 更新が必要な商品をクリックしたときに価格更新フォームに自動入力
function selectProductForUpdate(productId, productName) {
    // 商品を選択
    document.getElementById('select-product-mobile').value = productId;
    // 現在価格を表示
    onProductSelectedForPrice();
    // スクロールして価格更新フォームに移動
    document.querySelector('#market-price .summary-card:last-child').scrollIntoView({ behavior: 'smooth' });
}

// 商品選択時に現在価格を表示
function onProductSelectedForPrice() {
    const productId = document.getElementById('select-product-mobile').value;

    if (!productId) {
        document.getElementById('product-price-info').style.display = 'none';
        return;
    }

    const product = allProductsForPrice.find(p => p.id == productId);

    if (product) {
        const currentPrice = product.latest_market_price || product.purchase_price;
        document.getElementById('current-price-display').textContent = `¥${currentPrice.toLocaleString()}`;
        document.getElementById('product-price-info').style.display = 'block';
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
        const result = await apiPost('/api/market-prices', {
            product_id: parseInt(productId),
            price: parseFloat(price),
            date: date
        });

        if (result.success) {
            alert('価格を更新しました');
            // フォームをリセット
            document.getElementById('market-price-value-mobile').value = '';
            document.getElementById('select-product-mobile').value = '';
            document.getElementById('product-price-info').style.display = 'none';
            // 日付は今日のままにする
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('market-price-date-mobile').value = today;
            // 商品リストを再読み込み（現在価格が更新されているため）
            loadProductsForMarketPriceMobile();
        } else {
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('価格更新エラー:', error);
        alert('価格更新に失敗しました');
    }
}

// ================== Product Registration Form ==================
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
            const imageFile = document.getElementById('product-image-mobile').files[0];

            let imageData = null;
            if (imageFile) {
                // 画像をBase64に変換
                imageData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(imageFile);
                });
            }

            try {
                const result = await apiPost('/api/products', {
                    name: name,
                    purchase_date: date,
                    purchase_price: parseFloat(purchasePrice),
                    retail_price: parseFloat(retailPrice),
                    image_data: imageData,
                    categories: category ? [category] : []
                });

                if (result.success) {
                    alert('商品を登録しました');
                    form.reset();
                    document.getElementById('image-preview-mobile').style.display = 'none';
                } else {
                    alert('エラー: ' + result.error);
                }
            } catch (error) {
                console.error('商品登録エラー:', error);
                alert('商品登録に失敗しました');
            }
        });
    }

    // 画像プレビュー
    const imageInput = document.getElementById('product-image-mobile');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('preview-img-mobile').src = e.target.result;
                    document.getElementById('image-preview-mobile').style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                document.getElementById('image-preview-mobile').style.display = 'none';
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

// ================== Product Operations ==================
// 商品編集
async function editProductMobile(productId) {
    const product_name = prompt('商品名を入力してください:');
    if (!product_name) return;

    const purchase_date = prompt('購入日を入力してください (YYYY-MM-DD):');
    if (!purchase_date) return;

    const purchase_price = prompt('購入価格を入力してください:');
    if (!purchase_price) return;

    const retail_price = prompt('定価を入力してください:');
    if (!retail_price) return;

    try {
        const result = await apiPut(`/api/products/${productId}`, {
            name: product_name,
            purchase_date: purchase_date,
            purchase_price: parseFloat(purchase_price),
            retail_price: parseFloat(retail_price),
            categories: []
        });

        if (result.success) {
            alert('商品を更新しました');
            loadProductsMobile();
        } else {
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('商品更新エラー:', error);
        alert('商品更新に失敗しました');
    }
}

// 商品売却
async function sellProductMobile(productId, productName) {
    if (!confirm(`${productName}を売却しますか？`)) return;

    const sold_price = prompt('売却価格を入力してください:');
    if (!sold_price) return;

    const sold_date = prompt('売却日を入力してください (YYYY-MM-DD):');

    try {
        const result = await apiPost(`/api/products/${productId}/sell`, {
            sold_price: parseFloat(sold_price),
            sold_date: sold_date || null
        });

        if (result.success) {
            alert('商品を売却しました');
            loadProductsMobile();
        } else {
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('商品売却エラー:', error);
        alert('商品売却に失敗しました');
    }
}

// 商品削除
async function deleteProductMobile(productId, productName) {
    if (!confirm(`${productName}を完全に削除しますか？この操作は取り消せません。`)) return;

    try {
        const result = await apiDelete(`/api/products/${productId}`);

        if (result.success) {
            alert('商品を削除しました');
            // 現在アクティブなタブを確認してリロード
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'sold-products') {
                loadSoldProductsMobile();
            } else {
                loadProductsMobile();
            }
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        console.error('商品削除エラー:', error);
        alert('商品削除に失敗しました');
    }
}

// ================== Sold Products ==================
// 売却済み商品一覧を読み込み
async function loadSoldProductsMobile() {
    try {
        const result = await apiGet('/api/products/sold');

        if (result.success) {
            const products = result.products;
            let html = '';

            products.forEach(product => {
                const profit = product.sold_price - product.purchase_price;
                const profitClass = profit >= 0 ? 'text-success' : 'text-danger';
                const productName = (product.name || '').replace(/'/g, "\\'");

                html += `
                    <div class="product-card">
                        <div class="product-name">${product.name}</div>
                        <div class="product-info">購入日: ${product.purchase_date}</div>
                        <div class="product-info">売却日: ${product.sold_date || 'N/A'}</div>
                        <div class="product-info">購入価格: ¥${product.purchase_price.toLocaleString()}</div>
                        <div class="product-info">売却価格: ¥${product.sold_price.toLocaleString()}</div>
                        <div class="product-profit ${profitClass}">
                            損益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}
                        </div>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-warning me-1" onclick="unsellProductMobile(${product.id}, '${productName}')">
                                <i class="bi bi-arrow-counterclockwise"></i> 元に戻す
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProductMobile(${product.id}, '${productName}')">
                                <i class="bi bi-trash"></i> 削除
                            </button>
                        </div>
                    </div>
                `;
            });

            document.getElementById('sold-products-list-mobile').innerHTML = html || '<div class="loading">売却済み商品がありません</div>';
        }
    } catch (error) {
        console.error('売却済み商品読み込みエラー:', error);
    }
}

// 商品を元に戻す（売却取消）
async function unsellProductMobile(productId, productName) {
    if (!confirm(`${productName}を商品一覧に戻しますか？`)) return;

    try {
        const result = await apiPost(`/api/products/${productId}/unsell`, {});

        if (result.success) {
            alert('商品を元に戻しました');
            loadSoldProductsMobile();
        } else {
            alert('元に戻すのに失敗しました');
        }
    } catch (error) {
        console.error('商品復元エラー:', error);
        alert('商品復元に失敗しました');
    }
}

// ================== Product Detail ==================
// 商品詳細表示
let productChartInstance = null;

async function showProductDetailMobile(productId) {
    try {
        // 商品情報を取得
        const productResult = await apiGet(`/api/products/${productId}`);

        if (!productResult.success) {
            alert('商品情報の取得に失敗しました');
            return;
        }

        const product = productResult.product;
        const currentPrice = product.latest_market_price || product.purchase_price;
        const profit = currentPrice - product.purchase_price;
        const profitClass = profit >= 0 ? 'text-success' : 'text-danger';

        // モーダルタイトル設定
        document.getElementById('detailProductName').textContent = product.name;

        // 商品詳細を表示
        document.getElementById('product-detail-content').innerHTML = `
            <div class="mb-2"><strong>購入日:</strong> ${product.purchase_date}</div>
            <div class="mb-2"><strong>購入価格:</strong> ¥${product.purchase_price.toLocaleString()}</div>
            <div class="mb-2"><strong>定価:</strong> ¥${product.retail_price.toLocaleString()}</div>
            <div class="mb-2"><strong>現在価格:</strong> ¥${currentPrice.toLocaleString()}</div>
            <div class="mb-2 ${profitClass}"><strong>損益:</strong> ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}</div>
            ${product.categories && product.categories.length > 0 ?
                `<div class="mb-2"><strong>カテゴリー:</strong> ${product.categories.join(', ')}</div>` : ''}
        `;

        // 価格履歴を取得して表示
        const historyResult = await apiGet(`/api/products/${productId}/price-history`);

        if (historyResult.success && historyResult.history.length > 0) {
            let historyHtml = '<div class="list-group">';
            historyResult.history.forEach(h => {
                historyHtml += `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between">
                            <span>${h.price_date}</span>
                            <span class="fw-bold">¥${h.price.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            });
            historyHtml += '</div>';
            document.getElementById('price-history-list').innerHTML = historyHtml;

            // 価格推移グラフを表示
            const chartResult = await apiGet(`/api/products/${productId}/chart-data`);

            if (chartResult.success) {
                const ctx = document.getElementById('product-chart-mobile');

                if (ctx) {
                    // 既存のチャートを破棄
                    if (productChartInstance) {
                        productChartInstance.destroy();
                    }

                    // 購入価格のライン用データを作成
                    const purchasePriceLine = new Array(chartResult.data.labels.length).fill(chartResult.data.purchase_price);

                    productChartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: chartResult.data.labels,
                            datasets: [
                                chartResult.data.datasets[0],
                                {
                                    label: '購入価格',
                                    data: purchasePriceLine,
                                    borderColor: 'rgb(255, 99, 132)',
                                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                                    borderDash: [5, 5],
                                    tension: 0
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'bottom',
                                    labels: {
                                        font: {
                                            size: 10
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        font: {
                                            size: 10
                                        }
                                    }
                                },
                                x: {
                                    ticks: {
                                        font: {
                                            size: 9
                                        },
                                        maxRotation: 45,
                                        minRotation: 45
                                    }
                                }
                            }
                        }
                    });
                }
            }
        } else {
            document.getElementById('price-history-list').innerHTML = '<p class="text-muted">価格履歴がありません</p>';
        }

        // モーダルを表示
        const modal = new bootstrap.Modal(document.getElementById('productDetailModal'));
        modal.show();

    } catch (error) {
        console.error('商品詳細表示エラー:', error);
        alert('商品詳細の表示に失敗しました');
    }
}

// ================== Placeholder Functions ==================
// プレースホルダー関数（PC版との互換性のため）
function showSoldProducts() {
    showMobileTab('sold-products');
}

function showCategoryManagement() {
    alert('この機能はPC版をご利用ください');
}

function showProfitLoss() {
    alert('この機能はPC版をご利用ください');
}
