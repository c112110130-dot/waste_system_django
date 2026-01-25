// opp.js (修復版 - 解決新增資料按鈕無反應的問題)

// --- 全域變數 ---
let currentUser = "admin"; 
let currentDate = new Date();
let currentYear = currentDate.getFullYear(); 
let currentMonth = currentDate.getMonth() + 1; 
let showEmptyDepts = true; 
let isSortDescending = true;

let dashboardCharts = [];
let currentChartDataConfig = [];
let largeChartInstance = null;

// --- [動態日期] ---
let lastMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
let lastMonthStr = `${lastMonthDate.getFullYear()}/${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

function generateLast12MonthLabels() {
    let labels = [];
    for (let i = 11; i >= 0; i--) {
        let d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1 - i, 1);
        let yy = String(d.getFullYear()).slice(-2);
        let mm = String(d.getMonth() + 1).padStart(2, '0');
        labels.push(`${yy}-${mm}`);
    }
    return labels;
}
const dynamicLabels = generateLast12MonthLabels();

// --- 模擬資料 ---
let users = [ 
    { id: 1, unit_type:"院內單位", username:"系統管理員", unit:"資訊室", account:"admin", email:"admin@example.com", role:"管理員", created_at: new Date("2023/10/25 09:00:00"), created_by:"系統", updated_at: null },
    { id: 2, unit_type:"院內單位", username:"測試使用者", unit:"總務室", account:"test", email:"test@example.com", role:"一般人員", created_at: new Date("2023/10/25 10:00:00"), created_by:"系統管理員", updated_at: null },
];
let nextUserId = 3; 

let roles = [ 
    { id: 1, code:"ADMIN", role:"管理員", date: new Date("2023/10/25 08:00:00"), createdBy:"系統", updated_at: null},
    { id: 2, code:"USER", role:"一般人員", date: new Date("2023/10/25 08:00:00"), createdBy:"系統", updated_at: null},
]; 
let nextRoleId = 3;

let permissions = [ 
    { id: 1, role:"管理員", perms:{"使用者管理":["add","edit","delete","query"], "角色管理":["add","edit","delete","query"]}, date: new Date("2023/10/25 08:00:00"), createdBy:"系統", updated_at: null },
    { id: 2, role:"一般人員", perms:{"使用者管理":["query"], "角色管理":["query"]}, date: new Date("2023/10/25 08:00:00"), createdBy:"系統", updated_at: null }
]; 
let nextPermId = 3;

let departments = [
    { id: "d1", shortName: "W102", fullName: "病理組織部門" },
    { id: "d2", shortName: "W82", fullName: "護理部(門診)" },
    { id: "d3", shortName: "W103", fullName: "藥劑部" },
    { id: "d4", shortName: "W72", fullName: "放射科" },
    { id: "d5", shortName: "W71", fullName: "檢驗科" },
    { id: "d6", shortName: "W91", fullName: "教學研究部" },
    { id: "d7", shortName: "W51", fullName: "急診室" },
    { id: "d8", shortName: "W52", fullName: "手術室" },
    { id: "d9", shortName: "SCM", fullName: "新生兒加護" },
    { id: "d10", shortName: "W31", fullName: "產後護理" },
    { id: "d11", shortName: "W35", fullName: "洗腎室" },
    { id: "d12", shortName: "W73", fullName: "復健科" },
    { id: "d13", shortName: "W66", fullName: "營養室" },
];
let wasteRecords = []; 

const permissionFunctions = [
    { name: "使用者管理", perms: ["add", "edit", "delete", "query", "print"] },
    { name: "角色管理", perms: ["add", "edit", "delete", "query"] },
    { name: "權限管理", perms: ["add", "edit", "delete", "query"] },
    { name: "定點管理", perms: ["add", "edit", "delete", "query"] },
    { name: "產出單位管理", perms: ["add", "edit", "delete", "query"] },
    { name: "過磅人員管理", perms: ["add", "edit", "delete", "query"] },
    { name: "異常警報", perms: ["add", "edit", "delete", "query"] },
    { name: "廢棄物過磅日誌", perms: ["add", "edit", "delete", "query", "print"] },
];
const permLabels = { add: "新增", edit: "修改", delete: "刪除", query: "查詢", print: "列印" };

function generate24MonthData(originalLabels, originalDatasets) {
    let labels24 = [];
    for (let i = 23; i >= 0; i--) {
        let d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1 - i, 1);
        let yy = String(d.getFullYear()).slice(-2);
        let mm = String(d.getMonth() + 1).padStart(2, '0');
        labels24.push(`${yy}-${mm}`);
    }

    const extendedDatasets = originalDatasets.map(ds => {
        const historyData = ds.data.map(val => Math.round(val * (0.8 + Math.random() * 0.4))); 
        return {
            ...ds,
            data: [...historyData, ...ds.data]
        };
    });

    return {
        labels: labels24,
        datasets: extendedDatasets
    };
}

const chartConfigs = {
    'recyclable': [
        {
            title: `上月(${lastMonthStr})回收物質產量`, 
            type: "bar",
            labels: ['紙', '塑膠/鐵罐', '鋁罐', '玻璃'],
            datasets: [{ label: '產量', data: [7500, 1000, 1800, 300], backgroundColor: '#00aaff', borderRadius: 4 }]
        },
        {
            title: "近12月回收物質產量",
            type: "line",
            labels: dynamicLabels,
            datasets: [
                { label: '紙', data: [7500, 7800, 8200, 9000, 9200, 8900, 9100, 8500, 8000, 7600, 7200, 7600], borderColor: '#ff4d4f' },
                { label: '鐵罐', data: [1000, 1100, 1200, 1100, 1100, 1150, 1150, 1200, 1100, 1000, 1000, 1050], borderColor: '#00aaff' },
                { label: '塑膠', data: [2000, 2200, 2100, 2300, 2300, 2400, 2600, 2200, 2200, 2100, 2000, 1900], borderColor: '#ffc107' },
                { label: '玻璃', data: [500, 550, 600, 580, 600, 620, 650, 600, 580, 550, 520, 500], borderColor: '#20c997' }
            ]
        },
        {
            title: "近12月回收物質比例",
            type: "bar",
            labels: dynamicLabels,
            stacked: true,
            datasets: [
                { label: '紙', data: [65, 65, 65, 68, 68, 70, 72, 68, 68, 68, 68, 68], backgroundColor: '#ff4d4f' },
                { label: '鐵罐', data: [10, 10, 12, 10, 10, 8, 8, 10, 10, 10, 10, 10], backgroundColor: '#00aaff' },
                { label: '塑膠', data: [20, 20, 18, 17, 17, 17, 15, 17, 17, 17, 17, 17], backgroundColor: '#ffc107' },
                { label: '玻璃', data: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], backgroundColor: '#20c997' }
            ]
        },
        {
            title: "近12月回收收入",
            type: "line",
            labels: dynamicLabels,
            datasets: [{ label: '回收收入', data: [30000, 28000, 38000, 37000, 42000, 50000, 42000, 44000, 35000, 30000, 29000, 31000], borderColor: '#00aaff', fill: true, backgroundColor: 'rgba(0,170,255,0.1)' }]
        }
    ],
    'general': [
        {
            title: "近12月一般事業廢棄物產量",
            type: "line",
            labels: dynamicLabels,
            datasets: [
                { label: '南區', data: [120, 115, 130, 145, 140, 160, 135, 135, 130, 125, 120, 115], borderColor: '#ff4d4f' },
                { label: '仁武', data: [60, 62, 65, 63, 66, 68, 70, 65, 62, 64, 60, 58], borderColor: '#00aaff' }
            ]
        },
        {
            title: "近12月一般事業廢棄物比例",
            type: "bar",
            labels: dynamicLabels,
            stacked: true,
            datasets: [
                { label: '南區', data: [66, 65, 66, 69, 68, 70, 65, 66, 67, 66, 66, 66], backgroundColor: '#ff4d4f' },
                { label: '仁武', data: [34, 35, 34, 31, 32, 30, 35, 34, 33, 34, 34, 34], backgroundColor: '#00aaff' }
            ]
        },
        {
            title: "近12月一般事業廢棄物總產量",
            type: "line",
            labels: dynamicLabels,
            datasets: [{ label: '總產量', data: [180, 177, 195, 208, 206, 228, 205, 200, 192, 189, 180, 173], borderColor: '#20c997' }]
        }
    ],
    'medical': [
        {
            title: "近12月生物醫療廢棄物產量",
            type: "line",
            labels: dynamicLabels,
            datasets: [
                { label: '紅袋', data: [45, 52, 53, 40, 38, 35, 33, 38, 42, 40, 38, 35], borderColor: '#ff4d4f' },
                { label: '黃袋', data: [58, 62, 55, 50, 45, 46, 48, 52, 55, 53, 50, 51], borderColor: '#ffc107' }
            ]
        },
        {
            title: "近12月生物醫療廢棄物比例",
            type: "bar",
            labels: dynamicLabels,
            stacked: true,
            datasets: [
                { label: '紅袋', data: [42, 45, 48, 44, 45, 43, 40, 42, 43, 43, 43, 40], backgroundColor: '#ff4d4f' },
                { label: '黃袋', data: [58, 55, 52, 56, 55, 57, 60, 58, 57, 57, 57, 60], backgroundColor: '#ffc107' }
            ]
        },
        {
            title: "近12月生物醫療廢棄物總產量",
            type: "line",
            labels: dynamicLabels,
            datasets: [{ label: '總產量', data: [103, 114, 108, 90, 83, 81, 81, 90, 97, 93, 88, 86], borderColor: '#ffc107', fill: true, backgroundColor: 'rgba(255,193,7,0.1)' }]
        },
        {
            title: "近12月洗腎桶與軟袋產出",
            type: "line",
            labels: dynamicLabels,
            datasets: [
                { label: '洗腎桶', data: [3200, 3150, 3300, 3600, 3800, 3400, 3200, 3000, 3100, 3200, 3150, 3100], borderColor: '#00aaff' },
                { label: '軟袋', data: [1900, 1950, 2000, 2100, 1900, 1950, 1900, 1850, 1900, 1950, 1900, 1920], borderColor: '#20c997' }
            ]
        },
        {
            title: "近12月洗腎桶與軟袋處理費用",
            type: "line",
            labels: dynamicLabels,
            datasets: [{ label: '新台幣', data: [48000, 50000, 52000, 58000, 52000, 48000, 50000, 45000, 46000, 48000, 47000, 46000], borderColor: '#ff4d4f' }]
        }
    ],
    'glass': [
        {
            title: "近12月藥用玻璃產量",
            type: "line",
            labels: dynamicLabels,
            datasets: [{ label: '公斤', data: [4500, 4700, 4700, 5200, 5400, 5500, 5000, 5200, 4700, 4500, 4450, 4400], borderColor: '#00aaff' }]
        },
        {
            title: "近12月藥用玻璃處理費用",
            type: "line",
            labels: dynamicLabels,
            datasets: [{ label: '新台幣', data: [70000, 72000, 72000, 85000, 92000, 80000, 82000, 75000, 72000, 70000, 71000, 72000], borderColor: '#ff4d4f' }]
        }
    ]
};

const formatDateTime = (dateObj) => {
    if (!dateObj) return '';
    const date = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (isNaN(date)) return '';
    return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
};

function refreshIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try { lucide.createIcons(); } catch (e) { console.error("Lucide Error:", e); }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tabNavScroll = document.querySelector('.tab-nav-scroll');
    if (tabNavScroll) {
        tabNavScroll.addEventListener('click', (e) => {
            const tab = e.target.closest('button.tab-btn');
            if (tab) {
                e.preventDefault();
                showContent(tab.dataset.content);
            }
        });
    }
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 判斷關閉哪種類型的 Modal
            const chartModalContent = e.target.closest('.chart-modal-content');
            if(chartModalContent) {
                closeChartModal();
            } else {
                closeModal();
            }
        });
    });

    setTimeout(() => {
        showContent('dashboard'); 
        refreshIcons(); 
    }, 100); 
}); 

function showContent(type) { 
    const contentDiv = document.getElementById('content'); 
    contentDiv.innerHTML = ''; 
    refreshActiveTab(type);

    switch (type) {
        case 'dashboard': initDashboard(); break;
        case 'report-link': showReportLinkView(); break;
        case 'waste-dept': showDepartmentGrid(); break; 
        case 'user': showUserTable(); break;            
        case 'role': showRoleTable(); break;            
        case 'permission': showPermissionTable(); break;
        
        case 'waste-internal': loadView('generic-page-template', '廢棄物管理(院內)', '院內管理內容...'); break;
        case 'report-internal': loadView('generic-page-template', '廢棄物報表管理(院內)', '報表內容...'); break;
        case 'report-dept': loadView('generic-page-template', '廢棄物報表管理(部門)', '報表內容...'); break;
        case 'forecast': loadView('generic-page-template', '廢棄物預測', '預測內容...'); break;
        
        default: loadView('generic-page-template', '頁面', '功能開發中...');
    }
}

function refreshActiveTab(type) {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        if (tab.dataset.content === type) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function loadView(templateId, title, text) {
    const template = document.getElementById(templateId);
    if (!template) return null;
    const view = template.content.cloneNode(true);
    const contentDiv = document.getElementById('content'); 
    if (templateId === 'generic-page-template') {
        view.querySelector('#generic-page-title').textContent = title;
        view.querySelector('#generic-page-text').textContent = text;
    }
    contentDiv.appendChild(view);
    refreshIcons(); 
    return contentDiv; 
}

// --- [關鍵修正] 通用 Modal 控制 ---
function openUniversalModal(modalId, title, contentHTML, formId, submitHandler, modalClass = '') {
    // 1. 取得 Modal 本體 (這個 id 其實是在內層 div 上)
    const modalBox = document.getElementById(modalId);
    if (!modalBox) return;
    
    // 2. 設定標題與內容
    const headerTitle = modalBox.querySelector('.modal-header h3');
    if(headerTitle) headerTitle.textContent = title;
    
    const contentDiv = modalBox.querySelector('.modal-content');
    if(contentDiv) contentDiv.innerHTML = contentHTML;
    
    // 3. 設定額外樣式 (重置為 'modal')
    modalBox.className = 'modal'; 
    if (modalClass) modalBox.classList.add(modalClass);
    
    // 4. 綁定表單提交
    const form = modalBox.querySelector(`#${formId}`);
    if (form) {
        // 使用 cloneNode 移除舊的 event listener
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', submitHandler);
    }
    
    // 5. 綁定取消按鈕
    const cancelBtn = modalBox.querySelector('.btn-outline');
    if (cancelBtn) {
        const newBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
        newBtn.addEventListener('click', closeModal);
    }

    // 6. 顯示 Overlay 和 Modal
    const overlay = document.getElementById('modalOverlay');
    if(overlay) overlay.classList.add('active');
    modalBox.classList.add('active');
    
    refreshIcons(); 
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    
    // 關閉所有可能的 modal box
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function initDashboard() {
    const view = loadView('dashboard-template');
    if (!view) return;

    const summaryHeader = view.querySelector('.summary-header h2');
    if (summaryHeader) {
        summaryHeader.innerHTML = `${currentYear} 年 ${currentMonth} 月 <span class="subtitle">摘要</span>`;
    }

    if (typeof Chart === 'undefined') {
        console.error("Chart.js not loaded");
        return;
    }
    
    const firstBtn = document.querySelector('.flow-btn');
    if(firstBtn) {
        updateDashboardCharts('recyclable', firstBtn);
    }
}

window.updateDashboardCharts = function(type, btnElement) {
    document.querySelectorAll('.flow-btn').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');

    const configs = chartConfigs[type] || [];
    currentChartDataConfig = configs; 

    const container = document.getElementById('dynamic-charts-grid');
    if(!container) return;
    container.innerHTML = ''; 

    dashboardCharts.forEach(chart => chart.destroy());
    dashboardCharts = [];

    configs.forEach((config, index) => {
        const card = document.createElement('div');
        card.className = 'content-card chart-card';
        
        const header = document.createElement('div');
        header.className = 'chart-header';
        
        const title = document.createElement('h4');
        title.textContent = config.title;
        
        header.appendChild(title);

        if (!config.title.includes("上月")) {
            const maximizeBtn = document.createElement('button');
            maximizeBtn.className = "chart-maximize-btn";
            maximizeBtn.title = "放大檢視";
            maximizeBtn.onclick = function() { maximizeChart(index); };
            
            const icon = document.createElement('i');
            icon.dataset.lucide = "maximize-2"; 
            
            maximizeBtn.appendChild(icon);
            header.appendChild(maximizeBtn);
        }
        
        const body = document.createElement('div');
        body.className = 'chart-body';
        
        const canvas = document.createElement('canvas');
        canvas.id = `dynamicChart-${index}`;
        
        body.appendChild(canvas);
        card.appendChild(header);
        card.appendChild(body);
        container.appendChild(card);

        const ctx = canvas.getContext('2d');
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: config.datasets.length > 1, position: 'bottom' } },
            scales: config.stacked ? { x: { stacked: true }, y: { stacked: true } } : {}
        };

        const newChart = new Chart(ctx, {
            type: config.type,
            data: {
                labels: config.labels,
                datasets: config.datasets.map(ds => ({
                    ...ds,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2
                }))
            },
            options: chartOptions
        });
        
        dashboardCharts.push(newChart);
    });

    refreshIcons();
};

window.maximizeChart = function(index) {
    const config = currentChartDataConfig[index];
    if (!config) return;

    const modalOverlay = document.getElementById('chartModal');
    const modalBox = modalOverlay.querySelector('.modal');
    const modalTitle = document.getElementById('chartModalTitle');
    const canvas = document.getElementById('largeChartCanvas');
    
    modalTitle.textContent = config.title.replace("12月", "24月").replace("上月", "近24月");
    
    const expandedData = generate24MonthData(config.labels, config.datasets);

    if (window.largeChartInstance) {
        window.largeChartInstance.destroy();
    }

    // 顯示 Chart Modal (Overlay + Box)
    modalOverlay.classList.add('active');
    modalBox.classList.add('active');

    const ctx = canvas.getContext('2d');
    window.largeChartInstance = new Chart(ctx, {
        type: config.type,
        data: {
            labels: expandedData.labels,
            datasets: expandedData.datasets.map(ds => ({
                ...ds,
                borderWidth: 3, 
                tension: 0.4, 
                pointRadius: 4
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: config.stacked ? { x: { stacked: true }, y: { stacked: true } } : {},
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
};

window.closeChartModal = function() {
    const modalOverlay = document.getElementById('chartModal');
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
        const modalBox = modalOverlay.querySelector('.modal');
        if (modalBox) modalBox.classList.remove('active');
    }
};

function showReportLinkView() {
    const contentDiv = loadView('report-link-template');
    if (!contentDiv) return;
    
    const tabs = contentDiv.querySelectorAll('.report-tabs .tab-item');
    const panes = contentDiv.querySelectorAll('.report-tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            
            const targetId = tab.dataset.target;
            const targetPane = contentDiv.querySelector(`#${targetId}`);
            if(targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

function showDepartmentGrid() {
    const viewContainer = loadView('dept-grid-template');
    if (!viewContainer) return;

    const yearDisplay = viewContainer.querySelector('#year-display');
    yearDisplay.textContent = `${currentYear} 年`; 

    const updateYear = (change) => {
        currentYear += change;
        yearDisplay.textContent = `${currentYear} 年`;
        refreshDepartmentData(); 
    };
    viewContainer.querySelector('#btn-year-prev-10').addEventListener('click', () => updateYear(-10));
    viewContainer.querySelector('#btn-year-prev').addEventListener('click', () => updateYear(-1));
    viewContainer.querySelector('#btn-year-next').addEventListener('click', () => updateYear(1));
    viewContainer.querySelector('#btn-year-next-10').addEventListener('click', () => updateYear(10));

    const monthBtns = viewContainer.querySelectorAll('.btn-month');
    monthBtns.forEach((btn, index) => {
        if (index + 1 === currentMonth) btn.classList.add('active');
        btn.addEventListener('click', () => {
            monthBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMonth = index + 1;
            refreshDepartmentData();
        });
    });

    const sortBtn = viewContainer.querySelector('#sort-dept-btn');
    sortBtn.addEventListener('click', () => {
        isSortDescending = !isSortDescending;
        updateSortButtonUI(sortBtn);
        refreshDepartmentData();
    });
    updateSortButtonUI(sortBtn);

    const toggle = viewContainer.querySelector('#show-empty');
    toggle.checked = showEmptyDepts;
    toggle.addEventListener('change', (e) => {
        showEmptyDepts = e.target.checked;
        refreshDepartmentData();
    });

    viewContainer.querySelector('#dept-search-input').addEventListener('input', refreshDepartmentData);
    refreshDepartmentData();
}

function updateSortButtonUI(btn) {
    btn.innerHTML = isSortDescending 
        ? '<i data-lucide="arrow-down-z-a"></i> 排序 (降序)' 
        : '<i data-lucide="arrow-up-a-z"></i> 排序 (升序)';
    refreshIcons();
}

function refreshDepartmentData() {
    const searchInput = document.getElementById('dept-search-input');
    let deptsToRender = [...departments]; 
    
    if (searchInput && searchInput.value) {
        const term = searchInput.value.toLowerCase();
        deptsToRender = deptsToRender.filter(d => d.fullName.toLowerCase().includes(term) || d.shortName.toLowerCase().includes(term));
    }

    if (!showEmptyDepts) {
        deptsToRender = deptsToRender.filter(d => {
            return wasteRecords.some(r => r.deptId === d.id && r.year === currentYear && r.month === currentMonth);
        });
    }

    deptsToRender.sort((a, b) => {
        const cmp = a.shortName.localeCompare(b.shortName, undefined, { numeric: true });
        return isSortDescending ? -cmp : cmp;
    });

    renderDepartmentGrid(deptsToRender);
}

function renderDepartmentGrid(list) {
    const grid = document.getElementById('department-grid');
    if(!grid) return;
    grid.innerHTML = ''; 

    list.forEach(dept => {
        const record = wasteRecords.find(r => r.deptId === dept.id && r.year === currentYear && r.month === currentMonth);
        
        const card = document.createElement('div');
        card.className = 'dept-card';
        
        let statusText = "無資料";
        let statusColor = "var(--muted-foreground)";
        let btnClass = "btn-icon-green";
        let btnIcon = "plus";

        if (record) {
            statusText = `${record.weight} ${record.unit}`;
            statusColor = "var(--foreground)";
            btnClass = "btn-icon-yellow";
            btnIcon = "pencil";
        }

        card.innerHTML = `
            <div class="card-header-dept">
                <span>${dept.shortName}</span>
                <div class="card-actions">
                    <button class="btn-icon ${btnClass} add-btn" title="編輯/新增"><i data-lucide="${btnIcon}"></i></button>
                    <button class="btn-icon btn-icon-red del-btn" title="刪除"><i data-lucide="minus"></i></button>
                </div>
            </div>
            <div class="card-body-dept">
                <p class="dept-name">${dept.fullName}</p>
                <p class="dept-status" style="color: ${statusColor}">${statusText}</p>
            </div>
        `;
        
        card.querySelector('.add-btn').addEventListener('click', () => showAddWasteForm(dept.id));
        card.querySelector('.del-btn').addEventListener('click', () => deleteWasteData(dept.id));

        grid.appendChild(card);
    });
    refreshIcons();
}

function showAddWasteForm(deptId) {
    const dept = departments.find(d => d.id === deptId);
    const record = wasteRecords.find(r => r.deptId === deptId && r.year === currentYear && r.month === currentMonth);
    
    const val = record ? record.weight : "";
    const unit = record ? record.unit : "公斤";

    const html = `
        <div class="form-group">
            <label>重量：</label>
            <input type="number" id="wasteWeight" class="form-input" step="0.01" value="${val}" required autofocus>
        </div>
        <div class="form-group">
            <label>單位：</label>
            <select id="wasteUnit" class="form-input">
                <option value="公斤" ${unit==="公斤"?"selected":""}>公斤</option>
                <option value="公噸" ${unit==="公噸"?"selected":""}>公噸</option>
            </select>
        </div>
        <div class="modal-actions">
            <button type="submit" class="btn btn-primary">儲存</button>
            <button type="button" class="btn btn-outline">取消</button>
        </div>
    `;
    const formContent = `<form id="waste-form-inner">${html}</form>`;

    openUniversalModal('universalModal', `新增資料 - ${dept.fullName}`, formContent, 'waste-form-inner', (e) => {
        e.preventDefault();
        const w = parseFloat(document.getElementById('wasteWeight').value);
        const u = document.getElementById('wasteUnit').value;
        if(isNaN(w)) return alert("請輸入數值");

        const idx = wasteRecords.findIndex(r => r.deptId === deptId && r.year === currentYear && r.month === currentMonth);
        if (idx > -1) {
            wasteRecords[idx].weight = w;
            wasteRecords[idx].unit = u;
        } else {
            wasteRecords.push({ deptId, year: currentYear, month: currentMonth, weight: w, unit: u });
        }
        closeModal();
        refreshDepartmentData();
    });
}

function deleteWasteData(deptId) {
    const idx = wasteRecords.findIndex(r => r.deptId === deptId && r.year === currentYear && r.month === currentMonth);
    if (idx === -1) return alert("無資料可刪除");
    if (confirm("確定刪除?")) {
        wasteRecords.splice(idx, 1);
        refreshDepartmentData();
    }
}

function showUserTable() {
    const view = loadView('user-table-template');
    if (!view) return;
    view.querySelector('#searchUserBtn').addEventListener('click', searchUser);
    view.querySelector('#showAddUserFormBtn').addEventListener('click', () => showAddUserForm()); 
    searchUser(); 
}

function renderUserTable(list) {
    const tbody = document.querySelector('#userTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    document.getElementById('result').textContent = `查詢結果： ${list.length} 筆資料`;

    list.forEach((u, index) => { 
        const row = document.createElement('tr');
        let dateStr = formatDateTime(u.created_at);
        if(u.updated_at) dateStr += " (已編輯)";

        row.innerHTML = `
            <td class="text-center">${index+1}</td>
            <td>${u.username}</td><td>${u.unit}</td><td>${u.email}</td>
            <td class="text-center">${u.role}</td><td class="text-center">${dateStr}</td>
            <td class="text-center">${u.created_by}</td>
            <td class="text-center">
                <button class="btn btn-ghost edit-btn" data-id="${u.id}"><i data-lucide="edit"></i> 編輯</button>
                <button class="btn btn-ghost del-btn" data-id="${u.id}"><i data-lucide="trash-2"></i> 刪除</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const newTbody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newTbody, tbody);
    newTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if(!btn) return;
        const userId = parseInt(btn.dataset.id); 
        
        if(btn.classList.contains('edit-btn')) showAddUserForm(userId);
        if(btn.classList.contains('del-btn')) {
            if(confirm('確定刪除?')) {
                const indexToDelete = users.findIndex(u => u.id === userId);
                if (indexToDelete > -1) {
                    users.splice(indexToDelete, 1);
                    searchUser();
                }
            }
        }
    });
    refreshIcons();
}

function showAddUserForm(userId) { 
    const isEdit = userId !== undefined;
    const u = isEdit ? users.find(u => u.id === userId) || {} : {}; 
    const title = isEdit ? "編輯使用者" : "新增使用者";

    const html = `
        <form id="user-form-inner">
            <div class="form-group">
                <div class="radio-group">
                    <label><input type="radio" name="unitType" value="院內單位" ${!isEdit || u.unit_type==="院內單位"?"checked":""}> 院內單位</label>
                    <label><input type="radio" name="unitType" value="外部單位" ${u.unit_type==="外部單位"?"checked":""}> 外部單位</label>
                </div>
            </div>
            <div class="form-group"><label>使用者名稱</label><input type="text" id="userName" class="form-input" value="${u.username||''}" required></div>
            <div class="form-group"><label>單位</label>
                <select id="userUnit" class="form-input" required>
                    <option value="">請選擇</option>
                    ${departments.map(d=>`<option value="${d.fullName}" ${u.unit===d.fullName?'selected':''}>${d.fullName}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>帳號</label><input type="text" id="acc" class="form-input" value="${u.account||''}" required ${isEdit ? 'disabled title="帳號不可修改"' : ''}></div>
            <div class="form-group"><label>密碼</label><input type="password" id="pwd" class="form-input" placeholder="${isEdit?'留空不修改':'必填'}" ${!isEdit?'required':''}></div>
            <div class="form-group"><label>Email</label><input type="email" id="mail" class="form-input" value="${u.email||''}" required></div>
            <div class="form-group"><label>角色</label>
                <select id="uRole" class="form-input" required>
                    <option value="">請選擇</option>
                    ${roles.map(r=>`<option value="${r.role}" ${u.role===r.role?'selected':''}>${r.role}</option>`).join('')}
                </select>
            </div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">儲存</button>
                <button type="button" class="btn btn-outline">取消</button>
            </div>
        </form>
    `;
    
    openUniversalModal('universalModal', title, html, 'user-form-inner', (e) => {
        e.preventDefault();
        const form = e.target;
        const newPassword = form.querySelector('#pwd').value;
        const inputAccount = form.querySelector('#acc').value;
        const existingAccount = users.find(u => u.account === inputAccount);

        const newData = {
            unit_type: form.querySelector('[name=unitType]:checked').value,
            username: form.querySelector('#userName').value,
            unit: form.querySelector('#userUnit').value,
            account: inputAccount,
            email: form.querySelector('#mail').value,
            role: form.querySelector('#uRole').value
        };
        
        if(isEdit) {
            const index = users.findIndex(item => item.id === userId);
            if (index > -1) {
                users[index] = { 
                    ...users[index], 
                    ...newData, 
                    updated_at: new Date(),
                    password: newPassword ? newPassword : users[index].password 
                };
            }
        } else {
            if (existingAccount) {
                return alert("新增失敗：此帳號已存在！");
            }
            users.push({
                ...newData,
                id: nextUserId++, 
                password: newPassword, 
                created_at: new Date(), 
                updated_at: null,
                created_by: currentUser
            });
        }
        closeModal();
        searchUser();
    });
}

function searchUser() {
    const q1 = document.getElementById('query1')?.value.toLowerCase() || '';
    const q2 = document.getElementById('query2')?.value.toLowerCase() || '';
    
    const list = users.filter(u => 
        (u.username.toLowerCase().includes(q1) || u.account.toLowerCase().includes(q1)) && 
        u.unit.toLowerCase().includes(q2)
    );
    renderUserTable(list);
}

function showRoleTable() {
    const view = loadView('role-table-template');
    if (!view) return;
    view.querySelector('#searchRoleBtn').addEventListener('click', searchRole);
    view.querySelector('#showAddRoleFormBtn').addEventListener('click', () => showAddRoleForm());
    searchRole();
}

function renderRoleTable(list) {
    const tbody = document.querySelector('#roleTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    document.getElementById('result').textContent = `查詢結果： ${list.length} 筆資料`;

    list.forEach((r, index) => {
        const row = document.createElement('tr');
        let dateStr = formatDateTime(r.date);
        if(r.updated_at) dateStr += " (已編輯)";

        row.innerHTML = `
            <td class="text-center">${index+1}</td>
            <td>${r.code}</td><td>${r.role}</td>
            <td class="text-center">${dateStr}</td><td class="text-center">${r.createdBy}</td>
            <td class="text-center">
                <button class="btn btn-ghost edit-btn" data-id="${r.id}"><i data-lucide="edit"></i> 編輯</button>
                <button class="btn btn-ghost del-btn" data-id="${r.id}"><i data-lucide="trash-2"></i> 刪除</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const newTbody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newTbody, tbody);
    newTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if(!btn) return;
        const id = parseInt(btn.dataset.id);
        if(btn.classList.contains('edit-btn')) showAddRoleForm(id);
        if(btn.classList.contains('del-btn')) {
            if(confirm('確定刪除?')) {
                const idx = roles.findIndex(item => item.id === id);
                if(idx > -1) {
                    roles.splice(idx, 1);
                    searchRole();
                }
            }
        }
    });
    refreshIcons();
}

function showAddRoleForm(roleId) {
    const isEdit = roleId !== undefined;
    const r = isEdit ? roles.find(item => item.id === roleId) || {} : {};
    const title = isEdit ? "編輯角色" : "新增角色";

    const html = `
        <form id="role-form-inner">
            <div class="form-group"><label>代碼</label><input type="text" id="rCode" class="form-input" value="${r.code||''}" required></div>
            <div class="form-group"><label>名稱</label><input type="text" id="rName" class="form-input" value="${r.role||''}" required></div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">儲存</button>
                <button type="button" class="btn btn-outline">取消</button>
            </div>
        </form>
    `;
    
    openUniversalModal('universalModal', title, html, 'role-form-inner', (e) => {
        e.preventDefault();
        const newData = {
            code: document.getElementById('rCode').value,
            role: document.getElementById('rName').value
        };
        if(isEdit) {
            const idx = roles.findIndex(item => item.id === roleId);
            if(idx > -1) {
                roles[idx] = { ...roles[idx], ...newData, updated_at: new Date() };
            }
        } else {
            roles.push({
                ...newData,
                id: nextRoleId++,
                date: new Date(),
                createdBy: currentUser,
                updated_at: null
            });
        }
        closeModal();
        searchRole();
    });
}

function searchRole() {
    const q1 = document.getElementById('query1')?.value.toLowerCase() || '';
    const list = roles.filter(r => r.role.toLowerCase().includes(q1) || r.code.toLowerCase().includes(q1));
    renderRoleTable(list);
}

function showPermissionTable() {
    const view = loadView('permission-table-template');
    if (!view) return;
    view.querySelector('#searchPermissionBtn').addEventListener('click', searchPermission);
    view.querySelector('#showAddPermissionFormBtn').addEventListener('click', () => showAddPermissionForm());
    searchPermission();
}

function renderPermissionTable(list) {
    const tbody = document.querySelector('#PermissionTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    document.getElementById('result').textContent = `查詢結果： ${list.length} 筆資料`;

    list.forEach((p, index) => {
        const row = document.createElement('tr');
        let dateStr = formatDateTime(p.date);
        if(p.updated_at) dateStr += " (已編輯)";

        row.innerHTML = `
            <td class="text-center">${index+1}</td>
            <td>${p.role}</td>
            <td class="text-center">${dateStr}</td><td class="text-center">${p.createdBy}</td>
            <td class="text-center">
                <button class="btn btn-ghost view-btn" data-id="${p.id}"><i data-lucide="settings"></i> 權限內容</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const newTbody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newTbody, tbody);
    newTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button.view-btn');
        if(btn) showAddPermissionForm(parseInt(btn.dataset.id));
    });
    refreshIcons();
}

function showAddPermissionForm(permId) {
    const isEdit = permId !== undefined;
    const p = isEdit ? permissions.find(item => item.id === permId) || { perms: {} } : { perms: {} };
    const title = isEdit ? "編輯權限" : "新增權限";

    let tableHtml = '';
    permissionFunctions.forEach((func, i) => {
        const checkboxes = func.perms.map(k => {
            const checked = p.perms && p.perms[func.name] && p.perms[func.name].includes(k) ? 'checked' : '';
            return `<div class="permission-checkbox"><label><input type="checkbox" name="${func.name}" value="${k}" ${checked}> ${permLabels[k]}</label></div>`;
        }).join('');
        tableHtml += `<tr><td class="text-center">${i+1}</td><td>${func.name}</td><td class="permission-functions">${checkboxes}</td></tr>`;
    });

    const html = `
        <form id="perm-form-inner">
            <div class="form-group"><label>角色名稱</label><input type="text" id="pRole" class="form-input" value="${p.role||''}" required></div>
            <div class="permission-table-container">
                <table class="permission-table">
                    <thead><tr><th>序號</th><th>功能</th><th>權限</th></tr></thead>
                    <tbody>${tableHtml}</tbody>
                </table>
            </div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">儲存</button>
                <button type="button" class="btn btn-outline">取消</button>
            </div>
        </form>
    `;

    openUniversalModal('universalModal', title, html, 'perm-form-inner', (e) => {
        e.preventDefault();
        const form = e.target;
        const newPerms = {};
        permissionFunctions.forEach(func => {
            const checked = form.querySelectorAll(`input[name="${func.name}"]:checked`);
            if(checked.length) newPerms[func.name] = Array.from(checked).map(cb => cb.value);
        });
        
        const newData = { role: document.getElementById('pRole').value, perms: newPerms };
        
        if(isEdit) {
            const idx = permissions.findIndex(item => item.id === permId);
            if(idx > -1) {
                permissions[idx] = { ...permissions[idx], ...newData, updated_at: new Date() };
            }
        } else {
            permissions.push({
                ...newData,
                id: nextPermId++,
                date: new Date(),
                createdBy: currentUser,
                updated_at: null
            });
        }
        closeModal();
        searchPermission();
    }, 'permission-modal-width');
}

function searchPermission() {
    const q1 = document.getElementById('query1')?.value.toLowerCase() || '';
    const list = permissions.filter(p => p.role.toLowerCase().includes(q1));
    renderPermissionTable(list);
}