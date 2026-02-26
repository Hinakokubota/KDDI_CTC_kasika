// ヒートマップ用グローバル変数
let heatmapExpandedKDDI = new Set();
let heatmapExpandedCTC = new Set();

// ヒートマップ初期化
function initializeHeatmap() {
    // KDDI: 初期状態では全て折りたたみ、本部（headquarters）のみ表示
    // expandToHeatmapLevel(orgData.kddi.children, 'section', 'kddi');
    // CTC: 課（section）のみ表示（展開なし）
    // CTCは個人を含まず、sectionのみを表示

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
    if (count === 0) return '#F4F6FA';
    if (count <= 10) return 'rgba(0,92,202,0.12)';
    if (count <= 50) return 'rgba(0,92,202,0.30)';
    if (count <= 100) return 'rgba(0,92,202,0.55)';
    return 'rgb(14,13,106)';
}

// 件数に基づいて文字色を取得
function getHeatTextColor(count) {
    // 50件以上は白文字
    if (count > 50) return '#ffffff';
    return 'inherit';
}

// 表示する組織リストを取得
function getDisplayOrgs(data, company) {
    const orgs = [];
    const expanded = company === 'kddi' ? heatmapExpandedKDDI : heatmapExpandedCTC;

    function traverse(nodes, level = 0, prefix = company) {
        nodes.forEach(node => {
            const nodeId = `${prefix}-${node.id}`;

            // 検索フィルターが有効な場合、フィルタードノードに含まれていないノードは表示しない
            if (searchActive && filteredNodes && !filteredNodes.has(nodeId)) {
                return;
            }

            // ヒートマップでは個人を表示しない
            if (node.type === 'person') {
                return;
            }

            // KDDIの場合: headquarters, department, section を表示
            if (company === 'kddi' && node.type !== 'headquarters' && node.type !== 'department' && node.type !== 'section') {
                return;
            }

            // CTCの場合: section のみ表示
            if (company === 'ctc' && node.type !== 'section') {
                // CTCはsectionのみなので、子要素があっても展開せずsectionだけ取得
                if (node.children) {
                    traverse(node.children, level, prefix);
                }
                return;
            }

            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expanded.has(nodeId);

            orgs.push({
                id: nodeId,
                name: node.name,
                type: node.type,
                level: level,
                // KDDIのみ展開ボタンを表示、CTCは展開ボタンなし
                // sectionは最下層なので展開ボタンを表示しない
                hasChildren: company === 'kddi' && hasChildren && node.type !== 'section',
                isExpanded: company === 'kddi' && isExpanded,
                node: node
            });

            // KDDIの場合のみ子要素を展開
            if (company === 'kddi' && hasChildren && isExpanded) {
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

    // ヘッダー行（2行に分ける：1行目は階層レベル、2行目は組織名）
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row';

    // 左上隅
    const cornerCell = document.createElement('div');
    cornerCell.className = 'heatmap-cell header row-header corner';
    cornerCell.textContent = 'KDDI \\ CTC';
    cornerCell.style.backgroundColor = '#ffffff';
    cornerCell.style.color = '#000000';
    headerRow.appendChild(cornerCell);

    // 合計列のヘッダー
    const totalHeaderCell = document.createElement('div');
    totalHeaderCell.className = 'heatmap-cell header col-header total-header';
    totalHeaderCell.textContent = '合計';
    totalHeaderCell.title = 'KDDI組織ごとの全CTC組織との接続件数合計';
    totalHeaderCell.style.fontWeight = '700';
    totalHeaderCell.style.backgroundColor = '#ffffff';
    totalHeaderCell.style.color = '#000000';
    headerRow.appendChild(totalHeaderCell);

    // CTC組織名（列ヘッダー）
    ctcOrgs.forEach((org, index) => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell header col-header';

        // 階層レベルに応じたスタイル設定
        cell.dataset.level = org.level;
        cell.classList.add(`level-${org.level}`);

        // 親組織（子を持つ）の場合は太字と背景色を変更
        if (org.hasChildren && org.isExpanded) {
            cell.classList.add('parent-org');
        }

        const indent = '　'.repeat(org.level);
        const toggle = org.hasChildren
            ? `<span class="expand-toggle" data-company="ctc" data-id="${org.id}">${org.isExpanded ? '−' : '+'}</span>`
            : '';

        // 親組織には(合計)ラベルを追加
        const label = (org.hasChildren && org.isExpanded) ? '<span class="sum-label">(合計)</span>' : '';

        cell.innerHTML = `${indent}${toggle}${org.name}${label}`;
        cell.title = org.name + (org.hasChildren && org.isExpanded ? ' (下位階層の合計)' : '');

        // CTCのヘッダーは背景白、文字黒
        cell.style.backgroundColor = '#ffffff';
        cell.style.color = '#000000';

        headerRow.appendChild(cell);
    });

    grid.appendChild(headerRow);

    // データ行
    kddiOrgs.forEach((kddiOrg, rowIndex) => {
        const row = document.createElement('div');
        row.className = 'heatmap-row';

        // KDDI組織名（行ヘッダー）
        const rowHeader = document.createElement('div');
        rowHeader.className = 'heatmap-cell row-header';

        // 階層レベルに応じたスタイル設定
        rowHeader.dataset.level = kddiOrg.level;
        rowHeader.classList.add(`level-${kddiOrg.level}`);

        // 親組織（子を持つ）の場合は太字
        if (kddiOrg.hasChildren && kddiOrg.isExpanded) {
            rowHeader.classList.add('parent-org');
        }

        const indent = '　'.repeat(kddiOrg.level);
        const toggle = kddiOrg.hasChildren
            ? `<span class="expand-toggle" data-company="kddi" data-id="${kddiOrg.id}">${kddiOrg.isExpanded ? '−' : '+'}</span>`
            : '';

        // 親組織には(合計)ラベルを追加
        const label = (kddiOrg.hasChildren && kddiOrg.isExpanded) ? ' <span class="sum-label">(合計)</span>' : '';

        rowHeader.innerHTML = `${indent}${toggle}${kddiOrg.name}${label}`;

        // KDDIのヘッダーは全て同じ背景色（KDDIコーポレートカラー）、文字色は白
        rowHeader.style.backgroundColor = 'rgb(14, 13, 106)'; // KDDIコーポレートカラー
        rowHeader.style.color = '#ffffff'; // 白文字

        // 階層の境界線を追加: headquartersが変わるときのみ太い線
        if (rowIndex > 0 && kddiOrg.type === 'headquarters') {
            row.style.borderTop = '3px solid #666';
        }

        row.appendChild(rowHeader);

        // 合計列を追加（KDDI組織の全CTCとのコネクション合計）
        const totalCell = document.createElement('div');
        totalCell.className = 'heatmap-cell total-cell';

        // 全CTCとのコネクション数を計算
        let totalCount = 0;
        ctcOrgs.forEach(ctcOrg => {
            totalCount += calculateConnections(kddiOrg.node, ctcOrg.node);
        });

        totalCell.style.backgroundColor = getHeatColor(totalCount);
        totalCell.style.color = getHeatTextColor(totalCount);
        totalCell.textContent = totalCount > 0 ? totalCount : '';
        totalCell.style.fontWeight = '700';
        totalCell.title = `${kddiOrg.name} の合計接続件数: ${totalCount}件`;

        row.appendChild(totalCell);

        // データセル
        ctcOrgs.forEach((ctcOrg, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            // 親組織の列には特別なスタイルを適用
            if (ctcOrg.hasChildren && ctcOrg.isExpanded) {
                cell.classList.add('parent-col');
            }
            if (kddiOrg.hasChildren && kddiOrg.isExpanded) {
                cell.classList.add('parent-row');
            }

            const count = calculateConnections(kddiOrg.node, ctcOrg.node);
            cell.style.backgroundColor = getHeatColor(count);
            cell.style.color = getHeatTextColor(count);
            cell.textContent = count > 0 ? count : '';

            // データ属性
            cell.dataset.kddiOrg = kddiOrg.name;
            cell.dataset.ctcOrg = ctcOrg.name;
            cell.dataset.count = count;
            cell.dataset.level = `${kddiOrg.level}-${ctcOrg.level}`;

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
