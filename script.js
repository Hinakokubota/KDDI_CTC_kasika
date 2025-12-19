// グローバル変数
let orgData = null;
let expandedNodes = new Set();
let highlightedNodes = new Set();
let currentView = 'kddi'; // 現在のビュー: 'kddi', 'ctc'
let filteredNodes = null; // 検索フィルター適用時のノードセット（nullの場合はフィルターなし）
let searchActive = false; // 検索が有効かどうか

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeApp();
});

// データ読み込み
async function loadData() {
    try {
        const response = await fetch('data.json');
        orgData = await response.json();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました。');
    }
}

// アプリ初期化
function initializeApp() {
    // 初期表示設定
    // KDDI: 本部（headquarters）まで展開
    expandToLevel(orgData.kddi.children, 'headquarters', 'kddi');

    // CTC: 部（department）まで展開
    expandToLevel(orgData.ctc.children, 'department', 'ctc');

    // ツリー描画
    renderTree('kddi', orgData.kddi);
    renderTree('ctc', orgData.ctc);

    // イベントリスナー設定
    setupEventListeners();

    // コネクタ線描画
    setTimeout(() => drawConnectors(), 100);

    // ヒートマップ初期化
    setTimeout(() => initializeHeatmap(), 150);
}

// 指定レベルまで展開
function expandToLevel(nodes, targetType, prefix) {
    nodes.forEach(node => {
        if (node.type) {
            const nodeId = `${prefix}-${node.id}`;
            expandedNodes.add(nodeId);

            if (node.type !== targetType && node.children) {
                expandToLevel(node.children, targetType, prefix);
            }
        }
    });
}

// ツリー描画
function renderTree(company, data) {
    const container = document.getElementById(`${company}-tree`);
    container.innerHTML = '';

    // ルートノード
    const rootDiv = document.createElement('div');
    rootDiv.className = 'tree-node';
    rootDiv.innerHTML = `
        <div class="node-content headquarters" data-id="${company}-root">
            <div class="node-icon"></div>
            <div class="node-label">${data.name}</div>
        </div>
    `;
    container.appendChild(rootDiv);

    // 子ノード
    if (data.children) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'node-children';
        data.children.forEach(child => {
            renderNode(child, childrenDiv, company);
        });
        rootDiv.appendChild(childrenDiv);
    }
}

// ノード描画（再帰）
function renderNode(node, parentElement, company) {
    const nodeId = `${company}-${node.id}`;

    // 検索フィルターが有効な場合、フィルタードノードに含まれていないノードは表示しない
    if (searchActive && filteredNodes && !filteredNodes.has(nodeId)) {
        return;
    }

    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(nodeId);
    const isHighlighted = highlightedNodes.has(nodeId);

    nodeDiv.innerHTML = `
        <div class="node-content ${node.type} ${isHighlighted ? 'highlighted' : ''}"
             data-id="${nodeId}"
             data-company="${company}"
             data-type="${node.type}"
             data-name="${node.name}">
            ${hasChildren ? `<button class="expand-btn ${isExpanded ? 'expanded' : 'collapsed'}"></button>` : '<button class="expand-btn" disabled></button>'}
            <div class="node-icon"></div>
            <div class="node-label">${node.name}</div>
        </div>
    `;

    parentElement.appendChild(nodeDiv);

    // 展開ボタンのイベント
    if (hasChildren) {
        const expandBtn = nodeDiv.querySelector('.expand-btn');
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNode(nodeId);
        });
    }

    // 子ノード
    if (hasChildren) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = `node-children ${isExpanded ? '' : 'collapsed'}`;
        node.children.forEach(child => {
            renderNode(child, childrenDiv, company);
        });
        nodeDiv.appendChild(childrenDiv);
    }
}

// ノードの展開/折りたたみ
function toggleNode(nodeId) {
    if (expandedNodes.has(nodeId)) {
        expandedNodes.delete(nodeId);
    } else {
        expandedNodes.add(nodeId);
    }

    // ツリー再描画
    renderTree('kddi', orgData.kddi);
    renderTree('ctc', orgData.ctc);

    // コネクタ再描画
    setTimeout(() => drawConnectors(), 100);
}

// イベントリスナー設定
function setupEventListeners() {
    // 検索ボタン
    document.getElementById('search-button').addEventListener('click', performSearch);

    // 検索解除ボタン
    document.getElementById('clear-search-button').addEventListener('click', clearSearch);

    // Enterキーで検索
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // ビュー切り替えボタン
    document.getElementById('kddi-view-btn').addEventListener('click', () => switchView('kddi'));
    document.getElementById('ctc-view-btn').addEventListener('click', () => switchView('ctc'));

    // スクロールイベントでコネクタ再描画
    const kddTree = document.getElementById('kddi-tree');
    const ctcTree = document.getElementById('ctc-tree');

    kddTree.parentElement.addEventListener('scroll', () => {
        drawConnectors();
    });

    ctcTree.parentElement.addEventListener('scroll', () => {
        drawConnectors();
    });

    // ウィンドウリサイズ時にコネクタ再描画
    window.addEventListener('resize', () => {
        setTimeout(() => drawConnectors(), 100);
    });
}

// 検索実行
function performSearch() {
    const company = document.getElementById('company-select').value;
    const scope = document.getElementById('scope-select').value;
    const keyword = document.getElementById('keyword-input').value.trim();
    const position = document.getElementById('position-filter').value;
    const dateFilter = document.getElementById('date-filter').value; // YYYY-MM形式

    // ハイライトクリア
    highlightedNodes.clear();
    filteredNodes = new Set();
    searchActive = true;

    // 検索実行（フィルター含む）
    const searchResults = searchNodes(company.toLowerCase(), scope, keyword, position, dateFilter);

    if (searchResults.length === 0) {
        alert('該当する結果が見つかりませんでした。');
        filteredNodes = null;
        searchActive = false;
        return;
    }

    // 検索結果に基づいてフィルタードノードを設定
    searchResults.forEach(result => {
        highlightedNodes.add(result.nodeId);
        filteredNodes.add(result.nodeId);
        expandPathToNode(result.nodeId, result.company);

        // パスの全ノードも表示対象に追加
        const path = getNodePath(result.nodeId, result.company);
        path.forEach(nodeId => filteredNodes.add(nodeId));

        // 対向組織の相関ノードも追加
        addCorrelatedNodesToFilter(result.nodeId, company.toLowerCase());
    });

    // ツリー再描画
    renderTree('kddi', orgData.kddi);
    renderTree('ctc', orgData.ctc);

    // コネクタ再描画
    setTimeout(() => drawConnectors(), 100);

    // ヒートマップ再描画
    setTimeout(() => renderHeatmap(), 150);

    // 最初の結果にスクロール
    scrollToNode(searchResults[0].nodeId);
}

// 検索解除
function clearSearch() {
    highlightedNodes.clear();
    filteredNodes = null;
    searchActive = false;

    // フォームをクリア
    document.getElementById('keyword-input').value = '';
    document.getElementById('position-filter').value = '';
    document.getElementById('date-filter').value = '';

    // ツリー再描画
    renderTree('kddi', orgData.kddi);
    renderTree('ctc', orgData.ctc);

    // コネクタ再描画
    setTimeout(() => drawConnectors(), 100);

    // ヒートマップ再描画
    setTimeout(() => renderHeatmap(), 150);
}

// ノード検索（階層が開いていなくても検索可能）
function searchNodes(company, scope, keyword, position, dateFilter) {
    const results = [];
    const data = company === 'kddi' ? orgData.kddi : orgData.ctc;

    function search(nodes, prefix) {
        nodes.forEach(node => {
            let matches = false;

            // キーワード検索
            if (keyword) {
                matches =
                    (scope === 'department' && node.type !== 'person' && node.name.includes(keyword)) ||
                    (scope === 'person' && node.type === 'person' && node.name.includes(keyword));
            } else {
                // キーワードがない場合は、個人ノードを対象とする（フィルターのみの場合）
                matches = node.type === 'person';
            }

            // 役職フィルター（KDDIの個人のみ）
            if (matches && node.type === 'person' && position && prefix === 'kddi') {
                if (position === 'none') {
                    matches = !node.position || node.position === '';
                } else {
                    matches = node.position === position;
                }
            }

            // 最終接点日フィルター（KDDIの個人のみ）
            if (matches && node.type === 'person' && dateFilter && prefix === 'kddi') {
                if (node.lastContactDate) {
                    const nodeDate = node.lastContactDate.substring(0, 7); // YYYY/MM -> YYYY/MM
                    const filterDate = dateFilter; // YYYY-MM形式
                    const nodeDateFormatted = nodeDate.replace('/', '-'); // YYYY/MM -> YYYY-MM
                    matches = nodeDateFormatted >= filterDate;
                } else {
                    matches = false;
                }
            }

            if (matches) {
                results.push({
                    nodeId: `${prefix}-${node.id}`,
                    company: prefix,
                    node: node
                });
            }

            // 階層が開いていなくても再帰的に検索
            if (node.children) {
                search(node.children, prefix);
            }
        });
    }

    if (data.children) {
        search(data.children, company);
    }

    return results;
}

// ノードまでのパスを取得
function getNodePath(nodeId, company) {
    const data = company === 'kddi' ? orgData.kddi : orgData.ctc;
    const targetId = nodeId.split('-').slice(1).join('-'); // 'kddi-' or 'ctc-' を除く
    const path = [];

    function findPath(nodes, target, currentPath = []) {
        for (let node of nodes) {
            const fullId = `${company}-${node.id}`;
            const newPath = [...currentPath, fullId];

            if (node.id === target) {
                path.push(...newPath);
                return true;
            }

            if (node.children && findPath(node.children, target, newPath)) {
                return true;
            }
        }
        return false;
    }

    findPath(data.children, targetId);
    return path;
}

// ノードまでのパスを展開
function expandPathToNode(nodeId, company) {
    // ノードまでのパスを取得
    const path = getNodePath(nodeId, company);

    // パス上の全てのノードを展開
    path.forEach(id => {
        expandedNodes.add(id);
    });
}

// 相関ノードの自動展開
function expandCorrelatedNodes(nodeId, searchCompany) {
    const correlations = orgData.correlations || [];

    correlations.forEach(corr => {
        const kddiFull = `kddi-${corr.kddi}`;
        const ctcFull = `ctc-${corr.ctc}`;

        if (searchCompany === 'kddi' && nodeId === kddiFull) {
            // KDDI視点: CTC側を担当者まで展開
            expandPathToNode(ctcFull, 'ctc');
            expandToPersonLevel(ctcFull);
        } else if (searchCompany === 'ctc' && nodeId === ctcFull) {
            // CTC視点: KDDI側を部まで展開
            expandPathToNode(kddiFull, 'kddi');
            expandToDepartmentLevel(kddiFull);
        }
    });
}

// 担当者レベルまで展開（CTC側）
function expandToPersonLevel(nodeId) {
    expandedNodes.add(nodeId);
}

// 部レベルまで展開（KDDI側）
function expandToDepartmentLevel(nodeId) {
    expandedNodes.add(nodeId);
}

// 相関ノードをフィルターに追加
function addCorrelatedNodesToFilter(nodeId, searchCompany) {
    const correlations = orgData.correlations || [];

    correlations.forEach(corr => {
        const kddiFull = `kddi-${corr.kddi}`;
        const ctcFull = `ctc-${corr.ctc}`;

        if (searchCompany === 'kddi' && nodeId === kddiFull) {
            // KDDI視点: CTC側の相関ノードとそのパスを追加
            filteredNodes.add(ctcFull);
            const path = getNodePath(ctcFull, 'ctc');
            path.forEach(id => filteredNodes.add(id));
            expandPathToNode(ctcFull, 'ctc');
        } else if (searchCompany === 'ctc' && nodeId === ctcFull) {
            // CTC視点: KDDI側の相関ノードとそのパスを追加
            filteredNodes.add(kddiFull);
            const path = getNodePath(kddiFull, 'kddi');
            path.forEach(id => filteredNodes.add(id));
            expandPathToNode(kddiFull, 'kddi');
        }
    });
}

// ノードにスクロール
function scrollToNode(nodeId) {
    // 少し遅延させてDOMの更新を待つ
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${nodeId}"]`);
        if (element) {
            // 親コンテナを取得
            const parentContainer = element.closest('.org-panel');
            if (parentContainer) {
                // 要素の位置を計算
                const elementRect = element.getBoundingClientRect();
                const containerRect = parentContainer.getBoundingClientRect();

                // コンテナ内での相対位置を計算
                const relativeTop = element.offsetTop - parentContainer.offsetTop;

                // コンテナの中央に配置されるようにスクロール
                const scrollTop = relativeTop - (containerRect.height / 2) + (elementRect.height / 2);

                // スムーズにスクロール
                parentContainer.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                });

                // ハイライトをより目立たせるため、一時的にアニメーション効果を追加
                element.style.transition = 'background-color 0.5s';
                element.style.backgroundColor = '#fffacd';
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 2000);
            }
        }
    }, 200); // DOM更新後にスクロール
}

// 個人ノードが表示されているか確認
function isPersonNodeVisible(nodeId) {
    const element = document.querySelector(`[data-id="${nodeId}"]`);
    if (!element) return false;

    // 要素が存在し、折りたたまれた親要素の中にない場合、表示されている
    return !element.closest('.node-children.collapsed');
}

// 親ノードを取得（個人が表示されていない場合）
function findVisibleParentNode(nodeId, company) {
    // ノードIDからパスを分解
    const parts = nodeId.split('-').slice(1); // 'kddi-' or 'ctc-' を除く

    // データから該当ノードとその親を探す
    const data = company === 'kddi' ? orgData.kddi : orgData.ctc;

    function findNodeAndParents(nodes, targetId, parents = []) {
        for (let node of nodes) {
            if (node.id === targetId) {
                return parents;
            }
            if (node.children) {
                const result = findNodeAndParents(node.children, targetId, [...parents, node]);
                if (result) return result;
            }
        }
        return null;
    }

    const targetId = parts.join('-');

    // 個人ノードが表示されているか確認
    if (isPersonNodeVisible(nodeId)) {
        return nodeId;
    }

    // 表示されていない場合、親ノードを探す
    const parents = findNodeAndParents(data.children, targetId);
    if (!parents || parents.length === 0) {
        return null;
    }

    // 親ノードを逆順にチェック（最も近い親から）
    for (let i = parents.length - 1; i >= 0; i--) {
        const parentId = `${company}-${parents[i].id}`;
        const parentElement = document.querySelector(`[data-id="${parentId}"]`);
        if (parentElement && !parentElement.closest('.node-children.collapsed')) {
            return parentId;
        }
    }

    return `${company}-root`;
}

// コネクタ線描画
function drawConnectors() {
    const svg = document.getElementById('connector-svg');
    // 通常の矢印（右向き）と逆向きの矢印（左向き）の両方を定義
    svg.innerHTML = `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4A90E2" />
            </marker>
            <marker id="arrowhead-reverse" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
                <polygon points="10 0, 0 3.5, 10 7" fill="#4A90E2" />
            </marker>
        </defs>
    `;

    const correlations = orgData.correlations || [];

    correlations.forEach(corr => {
        const kddiNodeId = `kddi-${corr.kddi}`;
        const ctcNodeId = `ctc-${corr.ctc}`;

        // 個人ノードが表示されているか確認
        const kddiPersonVisible = isPersonNodeVisible(kddiNodeId);
        const ctcPersonVisible = isPersonNodeVisible(ctcNodeId);

        // 少なくとも片方の個人が表示されている場合のみコネクタを描画
        if (!kddiPersonVisible && !ctcPersonVisible) {
            return; // 両方とも個人が表示されていない場合は描画しない
        }

        // 表示されているノード（または親ノード）を取得
        const kddiVisibleId = findVisibleParentNode(kddiNodeId, 'kddi');
        const ctcVisibleId = findVisibleParentNode(ctcNodeId, 'ctc');

        if (kddiVisibleId && ctcVisibleId) {
            const kddiElement = document.querySelector(`[data-id="${kddiVisibleId}"]`);
            const ctcElement = document.querySelector(`[data-id="${ctcVisibleId}"]`);

            if (kddiElement && ctcElement) {
                // 常にKDDIからCTCへの線を描画し、ビューによって矢印の向きを変更
                const reverseArrow = currentView === 'ctc';
                drawLine(kddiElement, ctcElement, svg, reverseArrow);
            }
        }
    });
}

// 線描画
function drawLine(fromElement, toElement, svg, reverse = false) {
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    const x1 = fromRect.right - svgRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
    const x2 = toRect.left - svgRect.left;
    const y2 = toRect.top + toRect.height / 2 - svgRect.top;

    // 制御点を調整して、より短く直線的な線にする
    const distance = Math.abs(x2 - x1);
    const controlOffset = distance * 0.2; // 20%の位置に制御点を配置
    const cp1x = x1 + controlOffset;
    const cp2x = x2 - controlOffset;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'connector-line');

    // 矢印の向きを制御
    if (reverse) {
        // CTC View: 始点（KDDI側）に逆向きの矢印を配置
        path.setAttribute('marker-start', 'url(#arrowhead-reverse)');
    } else {
        // KDDI View: 終点（CTC側）に通常の矢印を配置
        path.setAttribute('marker-end', 'url(#arrowhead)');
    }

    svg.appendChild(path);
}

// ビュー切り替え
function switchView(view) {
    // 現在のビューを保存
    currentView = view;

    // ハイライトをクリア
    highlightedNodes.clear();

    // ボタンのアクティブ状態更新
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${view}-view-btn`).classList.add('active');

    const container = document.querySelector('.org-container');

    // 画面分割は常に1fr 1frで中央分割
    container.style.gridTemplateColumns = '1fr 1fr';

    // ツリー再描画（ハイライトを解除するため）
    renderTree('kddi', orgData.kddi);
    renderTree('ctc', orgData.ctc);

    setTimeout(() => drawConnectors(), 100);
}
