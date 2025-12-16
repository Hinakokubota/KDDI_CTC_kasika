// ヒートマップ用グローバル変数
let heatmapExpandedKDDI = new Set();
let heatmapExpandedCTC = new Set();

// ヒートマップ初期化
function initializeHeatmap() {
    // デフォルトで本部/部レベルまで展開
    // KDDI: 本部（headquarters）まで展開
    expandToHeatmapLevel(orgData.kddi.children, 'headquarters', 'kddi');
    // CTC: 部（department）まで展開
    expandToHeatmapLevel(orgData.ctc.children, 'department', 'ctc');

    renderHeatmap();
}

// 指定レベルまで展開（ヒートマップ用）
function expandToHeatmapLevel(nodes, targetType, company) {
    nodes.forEach(node => {
        if (node.type) {
            const nodeId = `${company}-${node.id}`;
            if (company === 'kddi') {
                heatmapExpandedKDDI.add(nodeId);
            } else {
                heatmapExpandedCTC.add(nodeId);
            }

            if (node.type !== targetType && node.children) {
                expandToHeatmapLevel(node.children, targetType, company);
            }
        }
    });
}

// 組織の全メンバーIDを取得
function getAllPersonIds(node) {
    const ids = [];

    function collect(n) {
        if (n.type === 'person') {
            ids.push(n.id);
        }
        if (n.children) {
            n.children.forEach(collect);
        }
    }

    collect(node);
    return ids;
}

// 2つの組織間のコネクション数を計算
function calculateConnections(kddiNode, ctcNode) {
    const kddiPersons = getAllPersonIds(kddiNode);
    const ctcPersons = getAllPersonIds(ctcNode);

    let count = 0;
    const correlations = orgData.correlations || [];

    correlations.forEach(corr => {
        if (kddiPersons.includes(corr.kddi) && ctcPersons.includes(corr.ctc)) {
            count++;
        }
    });

    return count;
}

// 件数に基づいて色を取得
function getHeatColor(count) {
    if (count === 0) return '#f0f0f0';
    if (count <= 2) return '#cfe2f3';
    if (count <= 5) return '#6fa8dc';
    if (count <= 10) return '#3c78d8';
    return '#1155cc';
}

// 表示する組織リストを取得
function getDisplayOrgs(data, company) {
    const orgs = [];
    const expanded = company === 'kddi' ? heatmapExpandedKDDI : heatmapExpandedCTC;

    function traverse(nodes, level = 0, prefix = company) {
        nodes.forEach(node => {
            const nodeId = `${prefix}-${node.id}`;
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expanded.has(nodeId);

            orgs.push({
                id: nodeId,
                name: node.name,
                type: node.type,
                level: level,
                hasChildren: hasChildren,
                isExpanded: isExpanded,
                node: node
            });

            if (hasChildren && isExpanded) {
                traverse(node.children, level + 1, prefix);
            }
        });
    }

    if (data.children) {
        traverse(data.children, 0, company);
    }

    return orgs;
}

// ヒートマップ描画
function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    grid.innerHTML = '';

    const kddiOrgs = getDisplayOrgs(orgData.kddi, 'kddi');
    const ctcOrgs = getDisplayOrgs(orgData.ctc, 'ctc');

    // ヘッダー行
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row';

    // 左上隅
    const cornerCell = document.createElement('div');
    cornerCell.className = 'heatmap-cell header row-header corner';
    cornerCell.textContent = 'KDDI \\ CTC';
    headerRow.appendChild(cornerCell);

    // CTC組織名（列ヘッダー）
    ctcOrgs.forEach(org => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell header col-header';
        cell.textContent = org.name;
        cell.title = org.name;
        headerRow.appendChild(cell);
    });

    grid.appendChild(headerRow);

    // データ行
    kddiOrgs.forEach(kddiOrg => {
        const row = document.createElement('div');
        row.className = 'heatmap-row';

        // KDDI組織名（行ヘッダー）
        const rowHeader = document.createElement('div');
        rowHeader.className = 'heatmap-cell row-header';

        const indent = '　'.repeat(kddiOrg.level);
        const toggle = kddiOrg.hasChildren
            ? `<span class="expand-toggle" data-company="kddi" data-id="${kddiOrg.id}">${kddiOrg.isExpanded ? '−' : '+'}</span>`
            : '';

        rowHeader.innerHTML = `${indent}${toggle}${kddiOrg.name}`;
        row.appendChild(rowHeader);

        // データセル
        ctcOrgs.forEach(ctcOrg => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            const count = calculateConnections(kddiOrg.node, ctcOrg.node);
            cell.style.backgroundColor = getHeatColor(count);
            cell.textContent = count > 0 ? count : '';

            // データ属性
            cell.dataset.kddiOrg = kddiOrg.name;
            cell.dataset.ctcOrg = ctcOrg.name;
            cell.dataset.count = count;

            // ホバーイベント
            cell.addEventListener('mouseenter', showTooltip);
            cell.addEventListener('mousemove', moveTooltip);
            cell.addEventListener('mouseleave', hideTooltip);

            row.appendChild(cell);
        });

        grid.appendChild(row);
    });

    // 展開/折りたたみイベント
    document.querySelectorAll('.expand-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const company = e.target.dataset.company;
            const id = e.target.dataset.id;
            toggleHeatmapOrg(company, id);
        });
    });
}

// 組織の展開/折りたたみ
function toggleHeatmapOrg(company, id) {
    const expanded = company === 'kddi' ? heatmapExpandedKDDI : heatmapExpandedCTC;

    if (expanded.has(id)) {
        expanded.delete(id);
    } else {
        expanded.add(id);
    }

    renderHeatmap();
}

// ツールチップ表示
let tooltip = null;

function showTooltip(e) {
    const cell = e.target;
    if (cell.classList.contains('header') || cell.classList.contains('row-header')) return;

    const kddiOrg = cell.dataset.kddiOrg;
    const ctcOrg = cell.dataset.ctcOrg;
    const count = cell.dataset.count;

    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'heatmap-tooltip';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="org-name">KDDI: ${kddiOrg}</div>
        <div class="org-name">CTC: ${ctcOrg}</div>
        <div>接続件数: <span class="count">${count}件</span></div>
    `;

    tooltip.style.display = 'block';
    moveTooltip(e);
}

function moveTooltip(e) {
    if (!tooltip) return;

    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
}

function hideTooltip() {
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}
