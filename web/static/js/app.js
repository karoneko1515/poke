// ========================================
// グローバル変数
// ========================================
let currentProducts = [];
let currentSoldProducts = [];
let sellModal;
let editModal;
let pastProductsModal;
let priceEditModal;

// キャッシュ機能
let productsCache = null;
let categoriesCache = null;
let dashboardCache = null;
let cacheTimestamp = {
    products: null,
    categories: null,
    dashboard: null
};
const CACHE_DURATION = 30000; // 30秒

// ========================================
// API ヘルパー関数（Fetch ベース）
// ========================================

/**
 * 汎用 API リクエスト関数
 */
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

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * GET リクエスト
 */
async function apiGet(endpoint) {
    return await apiRequest(endpoint, { method: 'GET' });
}

/**
 * POST リクエスト
 */
async function apiPost(endpoint, body) {
    return await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

/**
 * PUT リクエスト
 */
async function apiPut(endpoint, body) {
    return await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

/**
 * DELETE リクエスト
 */
async function apiDelete(endpoint) {
    return await apiRequest(endpoint, { method: 'DELETE' });
}

// ========================================
// キャッシュ管理
// ========================================

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

function isCacheValid(type) {
    const timestamp = cacheTimestamp[type];
    if (!timestamp) return false;
    return (Date.now() - timestamp) < CACHE_DURATION;
}

// ========================================
// ローディング UI
// ========================================

function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========================================
// アラート表示
// ========================================

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 3000);
}

// ========================================
// タブ切り替え
// ========================================

function showTab(tabName, element) {
    console.log('Switching to tab:', tabName);

    try {
        // 全てのタブコンテンツを非表示
        const allTabs = document.querySelectorAll('.tab-content');
        allTabs.forEach(tab => tab.style.display = 'none');

        // 選択されたタブを表示
        const selectedTab = document.getElementById(tabName);
        if (selectedTab) {
            selectedTab.style.display = 'block';
        }

        // ナビゲーションリンクのアクティブ状態を更新
        const allNavLinks = document.querySelectorAll('.nav-link');
        allNavLinks.forEach(link => link.classList.remove('active'));
        if (element) {
            element.classList.add('active');
        }

        // タブ切り替え時のデータ読み込み
        switch(tabName) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'products':
                loadProductsWithCategories();
                break;
            case 'market-price':
                loadMarketPriceTab();
                break;
            case 'charts':
                generatePortfolioChart();
                loadChartProductOptions();
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
    } catch (error) {
        console.error('Tab switching error:', error);
    }
}

// ========================================
// ダッシュボード
// ========================================

async function loadDashboard() {
    try {
        // キャッシュチェック
        if (isCacheValid('dashboard') && dashboardCache) {
            displayDashboard(dashboardCache);
            return;
        }

        const result = await apiGet('/api/portfolio/summary');

        if (result.success) {
            dashboardCache = result.summary;
            cacheTimestamp.dashboard = Date.now();
            displayDashboard(result.summary);
        } else {
            showAlert('danger', 'ダッシュボードデータの取得に失敗しました');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        showAlert('danger', 'ダッシュボードデータの取得中にエラーが発生しました');
    }
}

function displayDashboard(summary) {
    const summaryCards = document.getElementById('summary-cards');
    if (!summaryCards) return;

    const cards = [
        {
            title: '総投資額',
            value: `¥${summary.total_investment?.toLocaleString() || 0}`,
            color: 'info',
            icon: 'bi-wallet2'
        },
        {
            title: '現在価値',
            value: `¥${summary.current_value?.toLocaleString() || 0}`,
            color: 'primary',
            icon: 'bi-graph-up'
        },
        {
            title: '含み損益',
            value: `¥${summary.unrealized_pl?.toLocaleString() || 0}`,
            color: (summary.unrealized_pl || 0) >= 0 ? 'success' : 'danger',
            icon: (summary.unrealized_pl || 0) >= 0 ? 'bi-arrow-up-circle' : 'bi-arrow-down-circle'
        },
        {
            title: '実現損益',
            value: `¥${summary.realized_pl?.toLocaleString() || 0}`,
            color: (summary.realized_pl || 0) >= 0 ? 'success' : 'danger',
            icon: 'bi-cash-coin'
        }
    ];

    summaryCards.innerHTML = cards.map(card => `
        <div class="col-md-3 col-sm-6 mb-3">
            <div class="summary-card text-${card.color}">
                <h3><i class="${card.icon}"></i> ${card.title}</h3>
                <p class="display-6">${card.value}</p>
            </div>
        </div>
    `).join('');

    // パフォーマンス統計
    const performanceStats = document.getElementById('performance-stats');
    if (performanceStats) {
        const roi = summary.roi || 0;
        performanceStats.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>ROI:</strong> <span class="text-${roi >= 0 ? 'success' : 'danger'}">${roi.toFixed(2)}%</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>最高収益商品:</strong> ${summary.best_performer || 'データなし'}</p>
                </div>
            </div>
        `;
    }

    // ポートフォリオ情報
    const portfolioInfo = document.getElementById('portfolio-info');
    if (portfolioInfo) {
        portfolioInfo.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>保有商品数:</strong> ${summary.total_products || 0}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>売却済み:</strong> ${summary.sold_products || 0}</p>
                </div>
                <div class="col-md-12">
                    <p><strong>平均保有期間:</strong> ${summary.avg_holding_period || 0}日</p>
                </div>
            </div>
        `;
    }
}

// ========================================
// 商品一覧
// ========================================

async function loadProductsWithCategories() {
    try {
        await Promise.all([
            loadProducts(),
            loadCategoryFilter()
        ]);
    } catch (error) {
        console.error('Error loading products with categories:', error);
    }
}

async function loadProducts() {
    try {
        // キャッシュチェック
        if (isCacheValid('products') && productsCache) {
            currentProducts = productsCache;
            displayProducts(productsCache);
            return;
        }

        const result = await apiGet('/api/products');

        if (result.success) {
            currentProducts = result.products;
            productsCache = result.products;
            cacheTimestamp.products = Date.now();
            displayProducts(result.products);
        } else {
            showAlert('danger', '商品データの取得に失敗しました');
        }
    } catch (error) {
        console.error('Products load error:', error);
        showAlert('danger', '商品データの取得中にエラーが発生しました');
    }
}

function displayProducts(products) {
    const productsTable = document.getElementById('products-table');
    if (!productsTable) return;

    if (!products || products.length === 0) {
        productsTable.innerHTML = '<tr><td colspan="10" class="text-center">商品データがありません</td></tr>';
        return;
    }

    productsTable.innerHTML = products.map(product => {
        const currentPrice = product.latest_market_price || product.purchase_price;
        const profit = currentPrice - product.purchase_price;
        const profitRate = ((profit / product.purchase_price) * 100).toFixed(2);
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';

        const categories = [
            product.category1,
            product.category2,
            product.category3,
            product.category4,
            product.category5
        ].filter(c => c).join(', ');

        return `
            <tr>
                <td>
                    ${product.image_path ?
                        `<img src="/${product.image_path}" class="product-image" alt="${product.name}">` :
                        '<div class="product-image bg-secondary"></div>'}
                </td>
                <td>${product.name}</td>
                <td>${categories || '-'}</td>
                <td>${product.purchase_date}</td>
                <td>¥${product.purchase_price.toLocaleString()}</td>
                <td>¥${product.retail_price.toLocaleString()}</td>
                <td>¥${currentPrice.toLocaleString()}</td>
                <td class="${profitClass}">¥${profit.toLocaleString()}</td>
                <td class="${profitClass}">${profitRate}%</td>
                <td>
                    <div class="btn-group-sm">
                        <button class="btn btn-primary btn-sm" onclick="openEditModal(${product.id})">編集</button>
                        <button class="btn btn-success btn-sm" onclick="openSellModal(${product.id}, '${product.name}')">売却</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ========================================
// 商品登録
// ========================================

async function submitProductForm(event) {
    event.preventDefault();

    const name = document.getElementById('product-name').value;
    const purchaseDate = document.getElementById('purchase-date').value;
    const purchasePrice = document.getElementById('purchase-price').value;
    const retailPrice = document.getElementById('retail-price').value;
    const imageFile = document.getElementById('product-image').files[0];

    const categories = [
        document.getElementById('category1')?.value,
        document.getElementById('category2')?.value,
        document.getElementById('category3')?.value,
        document.getElementById('category4')?.value,
        document.getElementById('category5')?.value
    ].filter(c => c);

    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await fileToBase64(imageFile);
    }

    try {
        const result = await apiPost('/api/products', {
            name,
            purchase_date: purchaseDate,
            purchase_price: parseInt(purchasePrice),
            retail_price: parseInt(retailPrice),
            image_file: imageBase64,
            categories
        });

        if (result.success) {
            showAlert('success', '商品を登録しました');
            document.getElementById('product-form').reset();
            document.getElementById('image-preview').innerHTML = '';
            invalidateCache('products');
            invalidateCache('dashboard');
        } else {
            showAlert('danger', `商品の登録に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Product submission error:', error);
        showAlert('danger', '商品の登録中にエラーが発生しました');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========================================
// 画像プレビュー
// ========================================

function setupImagePreview() {
    const imageInput = document.getElementById('product-image');
    const previewDiv = document.getElementById('image-preview');

    if (!imageInput || !previewDiv) return;

    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewDiv.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 300px; border-radius: 8px;">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// ========================================
// 市場価格更新
// ========================================

async function loadMarketPriceTab() {
    await Promise.all([
        loadPriceProductOptions(),
        loadOutdatedProducts()
    ]);
}

async function loadPriceProductOptions() {
    try {
        const result = await apiGet('/api/products');

        if (result.success) {
            const select = document.getElementById('price-product');
            if (!select) return;

            select.innerHTML = '<option value="">商品を選択してください</option>' +
                result.products.map(p =>
                    `<option value="${p.id}">${p.name}</option>`
                ).join('');

            // 選択変更時に価格履歴を表示
            select.onchange = async function() {
                if (this.value) {
                    await loadPriceHistory(parseInt(this.value));
                } else {
                    document.getElementById('price-history').innerHTML = '';
                    document.getElementById('price-history-management').style.display = 'none';
                }
            };
        }
    } catch (error) {
        console.error('Error loading price product options:', error);
    }
}

async function loadPriceHistory(productId) {
    try {
        const result = await apiGet(`/api/products/${productId}/market-prices`);

        if (result.success && result.history.length > 0) {
            const historyDiv = document.getElementById('price-history');
            const managementDiv = document.getElementById('price-history-management');
            const tableBody = document.getElementById('price-history-table');

            historyDiv.innerHTML = `<h5>価格履歴</h5>`;
            managementDiv.style.display = 'block';

            tableBody.innerHTML = result.history.map(h => `
                <tr>
                    <td>${h.price_date}</td>
                    <td>¥${h.price.toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="openPriceEditModal(${h.id}, ${h.price}, '${h.price_date}')">編集</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMarketPrice(${h.id})">削除</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading price history:', error);
    }
}

async function submitPriceForm(event) {
    event.preventDefault();

    const productId = document.getElementById('price-product').value;
    const price = document.getElementById('market-price-value').value;
    const priceDate = document.getElementById('price-date').value;

    try {
        const result = await apiPost('/api/market-prices', {
            product_id: parseInt(productId),
            price: parseInt(price),
            price_date: priceDate
        });

        if (result.success) {
            showAlert('success', '市場価格を更新しました');
            document.getElementById('price-form').reset();
            invalidateCache('products');
            invalidateCache('dashboard');
            await loadPriceHistory(parseInt(productId));
            await loadOutdatedProducts();
        } else {
            showAlert('danger', `市場価格の更新に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Price submission error:', error);
        showAlert('danger', '市場価格の更新中にエラーが発生しました');
    }
}

async function loadOutdatedProducts() {
    try {
        const threshold = parseInt(document.getElementById('outdated-days-threshold')?.value || 7);
        const result = await apiGet(`/api/products/outdated?days_threshold=${threshold}`);

        if (result.success) {
            const listDiv = document.getElementById('outdated-products-list');
            if (!listDiv) return;

            if (result.products.length === 0) {
                listDiv.innerHTML = '<p class="text-success">全ての商品の価格が更新されています</p>';
                return;
            }

            listDiv.innerHTML = `
                <div class="alert alert-warning">
                    <strong>${result.products.length}件の商品</strong>が${threshold}日以上価格更新されていません
                </div>
                <ul class="list-group">
                    ${result.products.map(p => `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span>${p.name}</span>
                            <span class="badge bg-warning">${p.days_since_update}日前</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
    } catch (error) {
        console.error('Error loading outdated products:', error);
    }
}

function saveOutdatedDaysThreshold() {
    const value = document.getElementById('outdated-days-threshold')?.value;
    if (value) {
        localStorage.setItem('outdatedDaysThreshold', value);
    }
}

function loadOutdatedDaysThreshold() {
    const saved = localStorage.getItem('outdatedDaysThreshold');
    if (saved) {
        const input = document.getElementById('outdated-days-threshold');
        if (input) {
            input.value = saved;
        }
    }
}

// ========================================
// グラフ
// ========================================

async function generatePortfolioChart(periodMonths) {
    try {
        const url = periodMonths
            ? `/api/portfolio/chart-data?period_months=${periodMonths}`
            : '/api/portfolio/chart-data';

        const result = await apiGet(url);

        if (result.success) {
            const ctx = document.getElementById('portfolio-chart');
            if (!ctx) return;

            // 既存のチャートを破棄
            if (window.portfolioChartInstance) {
                window.portfolioChartInstance.destroy();
            }

            window.portfolioChartInstance = new Chart(ctx, {
                type: 'line',
                data: result.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'ポートフォリオ推移'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });

            // ボタンのアクティブ状態を更新
            document.querySelectorAll('#period-filter button').forEach(btn => {
                btn.classList.remove('active');
            });
            event?.target?.classList.add('active');
        } else {
            showAlert('warning', result.error || 'グラフデータがありません');
        }
    } catch (error) {
        console.error('Portfolio chart error:', error);
        showAlert('danger', 'グラフの生成中にエラーが発生しました');
    }
}

async function loadChartProductOptions() {
    try {
        const result = await apiGet('/api/products');

        if (result.success) {
            const select = document.getElementById('chart-product');
            if (!select) return;

            select.innerHTML = '<option value="">商品を選択してください</option>' +
                result.products.map(p =>
                    `<option value="${p.id}">${p.name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error loading chart product options:', error);
    }
}

async function generateProductChart() {
    const productId = document.getElementById('chart-product')?.value;
    if (!productId) return;

    try {
        const result = await apiGet(`/api/products/${productId}/chart-data`);

        if (result.success) {
            const ctx = document.getElementById('product-chart');
            if (!ctx) return;

            // 既存のチャートを破棄
            if (window.productChartInstance) {
                window.productChartInstance.destroy();
            }

            window.productChartInstance = new Chart(ctx, {
                type: 'line',
                data: result.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: `${result.data.product_name} - 価格推移`
                        },
                        annotation: {
                            annotations: {
                                purchaseLine: {
                                    type: 'line',
                                    yMin: result.data.purchase_price,
                                    yMax: result.data.purchase_price,
                                    borderColor: 'rgb(255, 99, 132)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    label: {
                                        content: `購入価格: ¥${result.data.purchase_price.toLocaleString()}`,
                                        enabled: true,
                                        position: 'end'
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        } else {
            showAlert('warning', result.error || '価格履歴がありません');
        }
    } catch (error) {
        console.error('Product chart error:', error);
        showAlert('danger', 'グラフの生成中にエラーが発生しました');
    }
}

async function generateCategoryChart() {
    try {
        const result = await apiGet('/api/categories/chart-data');

        if (result.success) {
            const ctx = document.getElementById('category-chart');
            if (!ctx) return;

            // 既存のチャートを破棄
            if (window.categoryChartInstance) {
                window.categoryChartInstance.destroy();
            }

            window.categoryChartInstance = new Chart(ctx, {
                type: 'bar',
                data: result.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'カテゴリー別投資分析'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '¥' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        } else {
            showAlert('warning', 'カテゴリーデータがありません');
        }
    } catch (error) {
        console.error('Category chart error:', error);
        showAlert('danger', 'グラフの生成中にエラーが発生しました');
    }
}

async function loadCategoryAnalysis() {
    try {
        const result = await apiGet('/api/categories/analysis');

        if (result.success) {
            const tableBody = document.getElementById('category-analysis-table');
            if (!tableBody) return;

            const analysis = result.analysis;
            const categories = Object.keys(analysis);

            if (categories.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="8" class="text-center">カテゴリーデータがありません</td></tr>';
                return;
            }

            tableBody.innerHTML = categories.map(cat => {
                const data = analysis[cat];
                return `
                    <tr>
                        <td>${cat}</td>
                        <td>${data.holding_count || 0}</td>
                        <td>¥${(data.total_purchase || 0).toLocaleString()}</td>
                        <td>¥${(data.total_market_value || 0).toLocaleString()}</td>
                        <td class="${(data.unrealized_pl || 0) >= 0 ? 'profit-positive' : 'profit-negative'}">
                            ¥${(data.unrealized_pl || 0).toLocaleString()}
                        </td>
                        <td>${data.sold_count || 0}</td>
                        <td>¥${(data.avg_profit || 0).toLocaleString()}</td>
                        <td>¥${(data.total_value || 0).toLocaleString()}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Category analysis error:', error);
    }
}

// ========================================
// 損益詳細
// ========================================

async function loadProfitLossDetails() {
    try {
        const result = await apiGet('/api/profit-loss/details');

        if (result.success) {
            const tableBody = document.getElementById('profit-loss-table');
            if (!tableBody) return;

            if (!result.details || result.details.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center">データがありません</td></tr>';
                return;
            }

            tableBody.innerHTML = result.details.map(item => {
                const profitClass = (item.profit || 0) >= 0 ? 'profit-positive' : 'profit-negative';
                const status = item.is_sold ? '<span class="badge bg-success">売却済み</span>' : '<span class="badge bg-primary">保有中</span>';

                return `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.purchase_date}</td>
                        <td>¥${item.purchase_price.toLocaleString()}</td>
                        <td>¥${(item.current_price || 0).toLocaleString()}</td>
                        <td class="${profitClass}">¥${(item.profit || 0).toLocaleString()}</td>
                        <td class="${profitClass}">${(item.profit_rate || 0).toFixed(2)}%</td>
                        <td>${status}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Profit/loss details error:', error);
    }
}

// ========================================
// 売却済み商品
// ========================================

async function loadSoldProducts() {
    try {
        const result = await apiGet('/api/products/sold');

        if (result.success) {
            currentSoldProducts = result.products;
            const tableBody = document.getElementById('sold-products-table');
            if (!tableBody) return;

            if (!result.products || result.products.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center">売却済み商品がありません</td></tr>';
                return;
            }

            tableBody.innerHTML = result.products.map(product => {
                const profit = (product.sold_price || 0) - product.purchase_price;
                const profitRate = ((profit / product.purchase_price) * 100).toFixed(2);
                const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';

                return `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.purchase_date}</td>
                        <td>¥${product.purchase_price.toLocaleString()}</td>
                        <td>${product.sold_date || '-'}</td>
                        <td>¥${(product.sold_price || 0).toLocaleString()}</td>
                        <td class="${profitClass}">¥${profit.toLocaleString()}</td>
                        <td class="${profitClass}">${profitRate}%</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Sold products error:', error);
    }
}

// ========================================
// カテゴリー管理
// ========================================

async function loadCategoryManagement() {
    await loadCategories();
}

async function loadCategories() {
    try {
        const result = await apiGet('/api/categories');

        if (result.success) {
            const categoriesList = document.getElementById('categories-list');
            if (!categoriesList) return;

            if (!result.categories || result.categories.length === 0) {
                categoriesList.innerHTML = '<p class="text-muted">登録されているカテゴリーがありません</p>';
                return;
            }

            categoriesList.innerHTML = result.categories.map(cat => `
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">${cat}</h5>
                            <button class="btn btn-danger btn-sm" onclick="deleteCategory('${cat}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Categories load error:', error);
    }
}

async function submitCategoryForm(event) {
    event.preventDefault();

    const categoryName = document.getElementById('new-category-name').value.trim();
    if (!categoryName) return;

    try {
        const result = await apiPost('/api/categories', {
            category_name: categoryName
        });

        if (result.success) {
            showAlert('success', 'カテゴリーを追加しました');
            document.getElementById('category-form').reset();
            invalidateCache('categories');
            await loadCategories();
            await loadCategoryOptionsForAllSelects();
        } else {
            showAlert('danger', `カテゴリーの追加に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Category submission error:', error);
        showAlert('danger', 'カテゴリーの追加中にエラーが発生しました');
    }
}

async function deleteCategory(categoryName) {
    if (!confirm(`カテゴリー「${categoryName}」を削除しますか？`)) {
        return;
    }

    try {
        const result = await apiDelete(`/api/categories/${encodeURIComponent(categoryName)}`);

        if (result.success) {
            showAlert('success', 'カテゴリーを削除しました');
            invalidateCache('categories');
            await loadCategories();
            await loadCategoryOptionsForAllSelects();
        } else {
            showAlert('danger', `カテゴリーの削除に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Category deletion error:', error);
        showAlert('danger', 'カテゴリーの削除中にエラーが発生しました');
    }
}

async function loadCategoryOptionsForAllSelects() {
    try {
        // キャッシュチェック
        if (isCacheValid('categories') && categoriesCache) {
            updateCategorySelects(categoriesCache);
            return;
        }

        const result = await apiGet('/api/categories');

        if (result.success) {
            categoriesCache = result.categories;
            cacheTimestamp.categories = Date.now();
            updateCategorySelects(result.categories);
        }
    } catch (error) {
        console.error('Error loading category options:', error);
    }
}

function updateCategorySelects(categories) {
    const selects = [
        'category1', 'category2', 'category3', 'category4', 'category5',
        'edit-category1', 'edit-category2', 'edit-category3', 'edit-category4', 'edit-category5',
        'search-category', 'category-filter'
    ];

    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentValue = select.value;
            const options = categories.map(cat =>
                `<option value="${cat}">${cat}</option>`
            ).join('');

            if (id === 'search-category' || id === 'category-filter') {
                select.innerHTML = '<option value="">全てのカテゴリー</option>' + options;
            } else {
                const placeholder = select.id.includes('edit')
                    ? `カテゴリー${id.slice(-1)}を選択`
                    : `カテゴリー${id.slice(-1)}を選択`;
                select.innerHTML = `<option value="">${placeholder}</option>` + options;
            }

            select.value = currentValue;
        }
    });

    // 既存カテゴリー表示
    const existingCategoriesSpan = document.getElementById('existing-categories');
    if (existingCategoriesSpan) {
        existingCategoriesSpan.textContent = categories.join(', ') || 'なし';
    }
}

async function loadCategoryFilter() {
    await loadCategoryOptionsForAllSelects();
}

// ========================================
// 検索・フィルター
// ========================================

async function searchProducts() {
    const searchName = document.getElementById('search-name')?.value || '';
    const dateFrom = document.getElementById('search-date-from')?.value || '';
    const dateTo = document.getElementById('search-date-to')?.value || '';

    try {
        const params = new URLSearchParams();
        if (searchName) params.append('search_term', searchName);
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);

        const result = await apiGet(`/api/products/search?${params}`);

        if (result.success) {
            currentProducts = result.products;
            displayProducts(result.products);
        }
    } catch (error) {
        console.error('Search error:', error);
        showAlert('danger', '検索中にエラーが発生しました');
    }
}

function clearSearch() {
    document.getElementById('search-name').value = '';
    document.getElementById('search-date-from').value = '';
    document.getElementById('search-date-to').value = '';
    document.getElementById('search-category').value = '';
    loadProducts();
}

function filterAndSortProducts() {
    let filtered = [...currentProducts];

    // カテゴリーフィルター
    const categoryFilter = document.getElementById('category-filter')?.value;
    if (categoryFilter) {
        filtered = filtered.filter(p =>
            [p.category1, p.category2, p.category3, p.category4, p.category5].includes(categoryFilter)
        );
    }

    // ソート
    const sortBy = document.getElementById('sort-by')?.value || 'purchase_date';
    const sortOrder = document.getElementById('sort-order')?.value || 'desc';

    filtered.sort((a, b) => {
        let aVal, bVal;

        switch(sortBy) {
            case 'name':
                aVal = a.name;
                bVal = b.name;
                break;
            case 'purchase_price':
                aVal = a.purchase_price;
                bVal = b.purchase_price;
                break;
            case 'current_price':
                aVal = a.latest_market_price || a.purchase_price;
                bVal = b.latest_market_price || b.purchase_price;
                break;
            case 'profit':
                aVal = (a.latest_market_price || a.purchase_price) - a.purchase_price;
                bVal = (b.latest_market_price || b.purchase_price) - b.purchase_price;
                break;
            case 'profit_rate':
                aVal = ((a.latest_market_price || a.purchase_price) - a.purchase_price) / a.purchase_price;
                bVal = ((b.latest_market_price || b.purchase_price) - b.purchase_price) / b.purchase_price;
                break;
            default:
                aVal = a.purchase_date;
                bVal = b.purchase_date;
        }

        if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    displayProducts(filtered);
}

function resetFiltersAndSort() {
    document.getElementById('category-filter').value = '';
    document.getElementById('sort-by').value = 'purchase_date';
    document.getElementById('sort-order').value = 'desc';
    displayProducts(currentProducts);
}

// ========================================
// モーダル操作
// ========================================

function openSellModal(productId, productName) {
    document.getElementById('sell-product-id').value = productId;
    document.getElementById('sell-product-name').textContent = productName;
    document.getElementById('sell-date').value = new Date().toISOString().split('T')[0];
    sellModal.show();
}

async function confirmSell() {
    const productId = parseInt(document.getElementById('sell-product-id').value);
    const soldPrice = parseInt(document.getElementById('sell-price').value);
    const soldDate = document.getElementById('sell-date').value;

    try {
        const result = await apiPost(`/api/products/${productId}/sell`, {
            sold_price: soldPrice,
            sold_date: soldDate
        });

        if (result.success) {
            showAlert('success', '商品を売却しました');
            sellModal.hide();
            document.getElementById('sell-form').reset();
            invalidateCache('products');
            invalidateCache('dashboard');
            await loadProducts();
        } else {
            showAlert('danger', `売却処理に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Sell error:', error);
        showAlert('danger', '売却処理中にエラーが発生しました');
    }
}

async function openEditModal(productId) {
    try {
        const result = await apiGet(`/api/products/${productId}`);

        if (result.success && result.product) {
            const product = result.product;

            document.getElementById('edit-product-id').value = product.id;
            document.getElementById('edit-product-name').value = product.name;
            document.getElementById('edit-purchase-date').value = product.purchase_date;
            document.getElementById('edit-purchase-price').value = product.purchase_price;
            document.getElementById('edit-retail-price').value = product.retail_price;

            // カテゴリー設定
            ['category1', 'category2', 'category3', 'category4', 'category5'].forEach((cat, idx) => {
                const select = document.getElementById(`edit-${cat}`);
                if (select) {
                    select.value = product[cat] || '';
                }
            });

            editModal.show();
        }
    } catch (error) {
        console.error('Error loading product for edit:', error);
        showAlert('danger', '商品情報の取得に失敗しました');
    }
}

async function confirmEdit() {
    const productId = parseInt(document.getElementById('edit-product-id').value);
    const name = document.getElementById('edit-product-name').value;
    const purchaseDate = document.getElementById('edit-purchase-date').value;
    const purchasePrice = parseInt(document.getElementById('edit-purchase-price').value);
    const retailPrice = parseInt(document.getElementById('edit-retail-price').value);

    const categories = [
        document.getElementById('edit-category1')?.value,
        document.getElementById('edit-category2')?.value,
        document.getElementById('edit-category3')?.value,
        document.getElementById('edit-category4')?.value,
        document.getElementById('edit-category5')?.value
    ].filter(c => c);

    try {
        const result = await apiPut(`/api/products/${productId}`, {
            name,
            purchase_date: purchaseDate,
            purchase_price: purchasePrice,
            retail_price: retailPrice,
            categories
        });

        if (result.success) {
            showAlert('success', '商品情報を更新しました');
            editModal.hide();
            invalidateCache('products');
            invalidateCache('dashboard');
            await loadProducts();
        } else {
            showAlert('danger', `更新に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Edit error:', error);
        showAlert('danger', '更新中にエラーが発生しました');
    }
}

async function showPastProducts() {
    try {
        const result = await apiGet('/api/products');

        if (result.success) {
            const tableBody = document.getElementById('past-products-table');
            if (!tableBody) return;

            // 商品名でグループ化
            const productsByName = {};
            result.products.forEach(p => {
                if (!productsByName[p.name]) {
                    productsByName[p.name] = [];
                }
                productsByName[p.name].push(p);
            });

            // 最新の購入日順にソート
            const uniqueProducts = Object.keys(productsByName).map(name => {
                const products = productsByName[name];
                products.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
                return products[0];
            });

            tableBody.innerHTML = uniqueProducts.map(p => `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.purchase_date}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="fillProductForm('${p.name}', ${p.purchase_price}, ${p.retail_price})">
                            使用
                        </button>
                    </td>
                </tr>
            `).join('');

            pastProductsModal.show();
        }
    } catch (error) {
        console.error('Error loading past products:', error);
    }
}

function fillProductForm(name, purchasePrice, retailPrice) {
    document.getElementById('product-name').value = name;
    document.getElementById('purchase-price').value = purchasePrice;
    document.getElementById('retail-price').value = retailPrice;
    pastProductsModal.hide();
}

function openPriceEditModal(priceId, price, priceDate) {
    document.getElementById('price-edit-id').value = priceId;
    document.getElementById('price-edit-value').value = price;
    document.getElementById('price-edit-date').value = priceDate.split(' ')[0];
    priceEditModal.show();
}

async function confirmPriceEdit() {
    const priceId = parseInt(document.getElementById('price-edit-id').value);
    const price = parseInt(document.getElementById('price-edit-value').value);
    const priceDate = document.getElementById('price-edit-date').value;

    try {
        const result = await apiPut(`/api/market-prices/${priceId}`, {
            price,
            price_date: priceDate
        });

        if (result.success) {
            showAlert('success', '価格を更新しました');
            priceEditModal.hide();
            invalidateCache('products');

            const productId = parseInt(document.getElementById('price-product').value);
            if (productId) {
                await loadPriceHistory(productId);
            }
        } else {
            showAlert('danger', `価格の更新に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Price edit error:', error);
        showAlert('danger', '価格の更新中にエラーが発生しました');
    }
}

async function deleteMarketPrice(priceId) {
    if (!confirm('この価格履歴を削除しますか？')) {
        return;
    }

    try {
        const result = await apiDelete(`/api/market-prices/${priceId}`);

        if (result.success) {
            showAlert('success', '価格履歴を削除しました');
            invalidateCache('products');

            const productId = parseInt(document.getElementById('price-product').value);
            if (productId) {
                await loadPriceHistory(productId);
            }
        } else {
            showAlert('danger', `削除に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        showAlert('danger', '削除中にエラーが発生しました');
    }
}

// ========================================
// フォームイベントハンドラー設定
// ========================================

function setupFormHandlers() {
    // 商品登録フォーム
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', submitProductForm);
    }

    // 価格更新フォーム
    const priceForm = document.getElementById('price-form');
    if (priceForm) {
        priceForm.addEventListener('submit', submitPriceForm);
    }

    // カテゴリー追加フォーム
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', submitCategoryForm);
    }

    // 画像プレビュー
    setupImagePreview();
}

// ========================================
// アプリケーション初期化
// ========================================

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

    // 初期データ読み込み（並列化でパフォーマンス改善）
    setTimeout(async () => {
        try {
            await Promise.all([
                loadDashboard(),
                loadProductsWithCategories(),
                loadCategoryOptionsForAllSelects()
            ]);
            console.log('初期データの読み込みが完了しました');
        } catch (error) {
            console.error('Data loading error:', error);
            showAlert('danger', 'データの読み込み中にエラーが発生しました');
        } finally {
            hideLoadingOverlay();
        }
    }, 100);

    // フォームイベントリスナー
    try {
        setupFormHandlers();
    } catch (error) {
        console.error('Form handler setup error:', error);
    }

    console.log('App initialization complete');
});
