// グローバル変数
let orgData = null;
let expandedNodes = new Set();
let highlightedNodes = new Set();

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
            <div class="node-label">${data.name} Headquarters</div>
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
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';

    const nodeId = `${company}-${node.id}`;
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

    // Enterキーで検索
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // ビュー切り替えボタン
    document.getElementById('kddi-view-btn').addEventListener('click', () => switchView('kddi'));
    document.getElementById('ctc-view-btn').addEventListener('click', () => switchView('ctc'));
    document.getElementById('full-view-btn').addEventListener('click', () => switchView('full'));

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

    if (!keyword) {
        alert('検索キーワードを入力してください。');
        return;
    }

    // ハイライトクリア
    highlightedNodes.clear();

    // 検索実行
    const searchResults = searchNodes(company.toLowerCase(), scope, keyword);

    if (searchResults.length === 0) {
        alert('該当する結果が見つかりませんでした。');
        return;
    }

    // 検索結果に基づいて展開とハイライト
    searchResults.forEach(result => {
        highlightedNodes.add(result.nodeId);
        expandPathToNode(result.nodeId, result.company);

        // 対向組織の自動展開
        expandCorrelatedNodes(result.nodeId, company.toLowerCase());
    });

    // ツリー再描画
    renderTree('kddi', orgData.kddi);
    renderTree('ctc', orgData.ctc);

    // コネクタ再描画
    setTimeout(() => drawConnectors(), 100);

    // 最初の結果にスクロール
    scrollToNode(searchResults[0].nodeId);
}

// ノード検索
function searchNodes(company, scope, keyword) {
    const results = [];
    const data = company === 'kddi' ? orgData.kddi : orgData.ctc;

    function search(nodes, prefix) {
        nodes.forEach(node => {
            const matches =
                (scope === 'department' && node.type !== 'person' && node.name.includes(keyword)) ||
                (scope === 'person' && node.type === 'person' && node.name.includes(keyword));

            if (matches) {
                results.push({
                    nodeId: `${prefix}-${node.id}`,
                    company: prefix,
                    node: node
                });
            }

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

// ノードまでのパスを展開
function expandPathToNode(nodeId, company) {
    const parts = nodeId.split('-');
    let currentPath = company;

    for (let i = 1; i < parts.length; i++) {
        currentPath += '-' + parts[i];
        expandedNodes.add(currentPath);
    }
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
    // すでにexpandPathToNodeで展開済み
}

// 部レベルまで展開（KDDI側）
function expandToDepartmentLevel(nodeId) {
    expandedNodes.add(nodeId);
    // 親ノードまで展開するが、担当者は開かない
}

// ノードにスクロール
function scrollToNode(nodeId) {
    const element = document.querySelector(`[data-id="${nodeId}"]`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// コネクタ線描画
function drawConnectors() {
    const svg = document.getElementById('connector-svg');
    svg.innerHTML = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#4A90E2" /></marker></defs>';

    const correlations = orgData.correlations || [];

    correlations.forEach(corr => {
        const kddiNodeId = `kddi-${corr.kddi}`;
        const ctcNodeId = `ctc-${corr.ctc}`;

        const kddiElement = document.querySelector(`[data-id="${kddiNodeId}"]`);
        const ctcElement = document.querySelector(`[data-id="${ctcNodeId}"]`);

        // 両方のノードが表示されている場合のみ線を描画
        if (kddiElement && ctcElement &&
            !kddiElement.closest('.node-children.collapsed') &&
            !ctcElement.closest('.node-children.collapsed')) {

            drawLine(kddiElement, ctcElement, svg);
        }
    });
}

// 線描画
function drawLine(fromElement, toElement, svg) {
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    const x1 = fromRect.right - svgRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
    const x2 = toRect.left - svgRect.left;
    const y2 = toRect.top + toRect.height / 2 - svgRect.top;

    const midX = (x1 + x2) / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'connector-line');
    path.setAttribute('marker-end', 'url(#arrowhead)');

    svg.appendChild(path);
}

// ビュー切り替え
function switchView(view) {
    // ボタンのアクティブ状態更新
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${view}-view-btn`).classList.add('active');

    const kddPanel = document.querySelector('.kddi-panel');
    const ctcPanel = document.querySelector('.ctc-panel');
    const container = document.querySelector('.org-container');

    // ビューに応じた表示切り替え
    if (view === 'kddi') {
        container.style.gridTemplateColumns = '2fr 1fr';
        kddPanel.style.display = 'block';
        ctcPanel.style.display = 'block';
    } else if (view === 'ctc') {
        container.style.gridTemplateColumns = '1fr 2fr';
        kddPanel.style.display = 'block';
        ctcPanel.style.display = 'block';
    } else {
        container.style.gridTemplateColumns = '1fr 1fr';
        kddPanel.style.display = 'block';
        ctcPanel.style.display = 'block';
    }

    setTimeout(() => drawConnectors(), 100);
}
