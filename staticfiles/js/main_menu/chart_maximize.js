// chart_maximize.js
import { calculateDateRange, generateLabels, alignDataWithLabels } from './utils.js';
import { getThemedOptions } from './chart_options.js';

// Keep track of which overview is currently showing
let currentOverviewId = 'recycleOverview';
let maximizedChart = null;
let extendedData = null;

export function initializeMaximizeButtons() {
    // Initially hide the maximized view
    document.getElementById('maximizedOverview').classList.add('has-hidden');

    // Set up maximize buttons for all charts
    const maximizeButtons = document.querySelectorAll('[id$="-maximize-btn"]');
    maximizeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const chartId = button.id.replace('-maximize-btn', '');
            maximizeChart(chartId);
        });
    });

    // Set up close button in maximized view
    const closeButton = document.querySelector('#maximizedOverview .ts-close');
    closeButton.addEventListener('click', restoreOriginalView);

    // Listen for theme changes to update maximized chart
    window.addEventListener('themeChanged', function(e) {
        if (maximizedChart) {
            // Recreate chart with new theme
            const currentChartId = maximizedChart.opts.chart.id;
            if (currentChartId && extendedData) {
                createMaximizedChart(currentChartId, extendedData);
            }
        }
    });
}

async function fetchExtendedData() {
    if (extendedData) return extendedData; // Use cached data if available

    try {
        const response = await fetch('/api/extended-chart-data/');
        if (!response.ok) {
            throw new Error('Failed to fetch extended chart data');
        }
        extendedData = await response.json();
        return extendedData;
    } catch (error) {
        return null;
    }
}

async function maximizeChart(chartId) {
    // Store which overview is currently visible
    const overviews = document.querySelectorAll('[id$="Overview"]');
    overviews.forEach(overview => {
        if (!overview.classList.contains('has-hidden') && overview.id !== 'maximizedOverview') {
            currentOverviewId = overview.id;
            // Hide the current overview
            overview.classList.add('has-hidden');
        }
    });

    // Show the maximized view
    const maximizedView = document.getElementById('maximizedOverview');
    maximizedView.classList.remove('has-hidden');

    // Update the title based on the chart being maximized
    const titleElement = maximizedView.querySelector('.ts-header');
    titleElement.textContent = '近24月' + getChartTitle(chartId);

    // Show loading indicator
    const container = document.getElementById('maximizedChart');
    container.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ts-loading is-large is-center-aligned';
    container.appendChild(loadingDiv);

    // Fetch extended data and create chart
    const data = await fetchExtendedData();
    if (data) {
        createMaximizedChart(chartId, data);
    } else {
        container.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ts-text is-negative';
        errorDiv.textContent = '無法獲取擴展數據';
        container.appendChild(errorDiv);
    }
}

function restoreOriginalView() {
    // Hide maximized view
    document.getElementById('maximizedOverview').classList.add('has-hidden');

    // Show the original overview
    document.getElementById(currentOverviewId).classList.remove('has-hidden');

    // Destroy the maximized chart to free resources
    if (maximizedChart) {
        maximizedChart.destroy();
        maximizedChart = null;
    }
}

function getChartTitle(chartId) {
    // Match chart ID to appropriate title
    const titles = {
        'barChartRecycleProductionCurrent': '回收物質產量',
        'lineChartRecycleProduction': '回收物質產量',
        'stackedBarChartRecycleProductionPercentage': '回收物質比例',
        'lineChartRecycleRevenue': '回收收入',
        'lineChartGeneralWasteProduction': '一般事業廢棄物產量',
        'stackedBarChartGeneralWasteProductionPercentage': '一般事業廢棄物比例',
        'lineChartGeneralWasteProductionTotal': '一般事業廢棄物總產量',
        'lineChartBiomedicalWasteProduction': '生物醫療廢棄物產量',
        'stackedBarChartBiomedicalWasteProductionPercentage': '生物醫療廢棄物比例',
        'lineChartBiomedicalWasteProductionTotal': '生物醫療廢棄物總產量',
        'lineChartDialBucketAndSoftBagProduction': '洗腎桶與軟袋產出',
        'lineChartDialBucketAndSoftBagDisposalCosts': '洗腎桶與軟袋處理費用',
        'lineChartPharGlassProduction': '藥用玻璃產量',
        'lineChartPharGlassDisposalCosts': '藥用玻璃處理費用'
    };

    return titles[chartId] || '圖表';
}

function createMaximizedChart(chartId, extendedData) {
    // Get the container for the maximized chart
    const container = document.getElementById('maximizedChart');

    // Clear any previous chart
    container.innerHTML = '';
    if (maximizedChart) {
        maximizedChart.destroy();
    }

    // Create appropriate chart based on chart ID and extended data
    const chartOptions = createChartOptions(chartId, extendedData);

    if (chartOptions) {
        maximizedChart = new ApexCharts(container, chartOptions);
        maximizedChart.render();
    } else {
        container.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ts-text is-negative';
        errorDiv.textContent = '無法創建擴展圖表';
        container.appendChild(errorDiv);
    }
}

// Utility function similar to the one in charts.js
const formatNumber = (val, unit) => {
    if (val == null) return 'N/A';
    const numStr = Number(val).toFixed(2).replace(/\.0+$/, '');
    return unit === '新台幣' ? `${formatNumberWithCommas(numStr)} ${unit}` : `${numStr} ${unit}`;
};

// Utility function similar to the one in charts.js
const formatNumberWithCommas = (value) => {
    return Number(value).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function createChartOptions(chartId, data) {
    // Create chart options based on the chart ID and extended data from backend
    const recycleData = data.recycle || {};
    const generalData = data.general || {};
    const biomedicalData = data.biomedical || {};
    const pharGlassData = data.pharGlass || {};

    // Get extended labels from the data
    let xAxisLabels = [];

    // Try to get labels from the appropriate dataset
    if (chartId.includes('Recycle') && recycleData.last24Months?.labels) {
        xAxisLabels = recycleData.last24Months.labels;
    } else if (chartId.includes('General') && generalData.last24Months?.labels) {
        xAxisLabels = generalData.last24Months.labels;
    } else if (chartId.includes('Biomedical') && biomedicalData.last24Months?.labels) {
        xAxisLabels = biomedicalData.last24Months.labels;
    } else if (chartId.includes('Dial') && biomedicalData.dialysis24Months?.labels) {
        xAxisLabels = biomedicalData.dialysis24Months.labels;
    } else if (chartId.includes('PharGlass') && pharGlassData.last24Months?.labels) {
        xAxisLabels = pharGlassData.last24Months.labels;
    }

    // Common settings for maximized chart with theme integration
    const maximizedBaseOptions = getThemedOptions();
    maximizedBaseOptions.chart = {
        ...maximizedBaseOptions.chart,
        height: 650, // Taller chart for maximized view
        toolbar: { show: true },
        zoom: { enabled: true },
        id: chartId // Store chart ID for theme updates
    };

    // Handle different chart types
    switch (chartId) {
        case 'barChartRecycleProductionCurrent':
            if (recycleData.lastMonth && Array.isArray(recycleData.lastMonth.data)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'bar'
                    },
                    series: [{
                        name: '產量 (公斤)',
                        data: recycleData.lastMonth.data.filter(val => val != null)
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: recycleData.lastMonth.labels || [], title: { text: '類別' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公斤' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公斤') } }
                };
            }
            break;

        case 'lineChartRecycleProduction':
            if (recycleData.last24Months && Array.isArray(recycleData.last24Months.labels)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: Object.keys(recycleData.last24Months.datasets || {}).map(key => ({
                        name: key,
                        data: recycleData.last24Months.datasets[key].data || []
                    })),
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公斤' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公斤') } },
                    colors: Object.values(recycleData.last24Months.datasets || {}).map(d => d.color || '#000000')
                };
            }
            break;

        case 'lineChartRecycleRevenue':
            if (recycleData.revenue24Months && Array.isArray(recycleData.revenue24Months.data)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: [{
                        name: '收入 (新台幣)',
                        data: recycleData.revenue24Months.data || []
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '新台幣' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => formatNumberWithCommas(Math.floor(val)) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '新台幣') } },
                    colors: ['#36A2EB']
                };
            }
            break;

        // Stacked bar charts for percentages - these are special
        case 'stackedBarChartRecycleProductionPercentage':
            if (recycleData.last24Months && Array.isArray(recycleData.last24Months.labels)) {
                const period = document.querySelector('input[name="recyclePeriod"]:checked').value || 'monthly';
                const isTotal = period === 'total';
                const datasets = recycleData.last24Months.datasets || {};

                const validDatasets = {};
                Object.keys(datasets).forEach(key => {
                    const filteredData = datasets[key].data.filter(val => val != null);
                    if (filteredData.length) validDatasets[key] = { data: datasets[key].data, color: datasets[key].color || '#000000' };
                });

                const seriesData = isTotal
                    ? Object.values(validDatasets).map(d => d.data.reduce((a, b) => a + b, 0))
                    : Object.keys(validDatasets).map(key => ({
                        name: key,
                        data: validDatasets[key].data.map((val, i) => {
                            const total = Object.values(validDatasets).reduce((sum, d) => sum + (d.data[i] || 0), 0);
                            return total ? (val / total * 100) : 0;
                        })
                    }));

                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: isTotal ? 'pie' : 'bar',
                        stacked: !isTotal
                    },
                    series: seriesData,
                    ...(isTotal ? {
                        labels: Object.keys(validDatasets),
                        dataLabels: {
                            enabled: true,
                            formatter: val => formatNumber(val, '%'),
                            style: {
                                fontSize: '14px',
                                fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                            }
                        },
                        tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公斤') } }
                    } : {
                        xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                        yaxis: {
                            ...maximizedBaseOptions.yaxis,
                            title: { text: '百分比' },
                            min: 0,
                            max: 100,
                            labels: {
                                ...maximizedBaseOptions.yaxis.labels,
                                formatter: val => Math.floor(val)
                            }
                        },
                        tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '%') } }
                    }),
                    colors: Object.values(validDatasets).map(d => d.color)
                };
            }
            break;

        case 'lineChartGeneralWasteProduction':
            if (generalData.last24Months && Array.isArray(generalData.last24Months.labels)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: Object.keys(generalData.last24Months.datasets || {}).map(key => ({
                        name: key,
                        data: generalData.last24Months.datasets[key].data || []
                    })),
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公噸' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公噸') } },
                    colors: Object.values(generalData.last24Months.datasets || {}).map(d => d.color || '#000000')
                };
            }
            break;

        case 'stackedBarChartGeneralWasteProductionPercentage':
            if (generalData.last24Months && Array.isArray(generalData.last24Months.labels)) {
                const period = document.querySelector('input[name="generalPeriod"]:checked').value || 'monthly';
                const isTotal = period === 'total';
                const datasets = generalData.last24Months.datasets || {};

                const validDatasets = {};
                Object.keys(datasets).forEach(key => {
                    const filteredData = datasets[key].data.filter(val => val != null);
                    if (filteredData.length) validDatasets[key] = { data: datasets[key].data, color: datasets[key].color || '#000000' };
                });

                const seriesData = isTotal
                    ? Object.values(validDatasets).map(d => d.data.reduce((a, b) => a + b, 0))
                    : Object.keys(validDatasets).map(key => ({
                        name: key,
                        data: validDatasets[key].data.map((val, i) => {
                            const total = Object.values(validDatasets).reduce((sum, d) => sum + (d.data[i] || 0), 0);
                            return total ? (val / total * 100) : 0;
                        })
                    }));

                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: isTotal ? 'pie' : 'bar',
                        stacked: !isTotal
                    },
                    series: seriesData,
                    ...(isTotal ? {
                        labels: Object.keys(validDatasets),
                        dataLabels: {
                            enabled: true,
                            formatter: val => formatNumber(val, '%'),
                            style: {
                                fontSize: '14px',
                                fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                            }
                        },
                        tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公噸') } }
                    } : {
                        xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                        yaxis: {
                            ...maximizedBaseOptions.yaxis,
                            title: { text: '百分比' },
                            min: 0,
                            max: 100,
                            labels: {
                                ...maximizedBaseOptions.yaxis.labels,
                                formatter: val => Math.floor(val)
                            }
                        },
                        tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '%') } }
                    }),
                    colors: Object.values(validDatasets).map(d => d.color)
                };
            }
            break;

        case 'lineChartGeneralWasteProductionTotal':
            if (generalData.last24Months && Array.isArray(generalData.last24Months.total)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: [{
                        name: '總產量 (公噸)',
                        data: generalData.last24Months.total || []
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公噸' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公噸') } },
                    colors: ['#4BC0C0']
                };
            }
            break;

        case 'lineChartBiomedicalWasteProduction':
            if (biomedicalData.last24Months && Array.isArray(biomedicalData.last24Months.labels)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: Object.keys(biomedicalData.last24Months.datasets || {}).map(key => ({
                        name: key,
                        data: biomedicalData.last24Months.datasets[key].data || []
                    })),
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公噸' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公噸') } },
                    colors: Object.values(biomedicalData.last24Months.datasets || {}).map(d => d.color || '#000000')
                };
            }
            break;

        case 'stackedBarChartBiomedicalWasteProductionPercentage':
            if (biomedicalData.last24Months && Array.isArray(biomedicalData.last24Months.labels)) {
                const period = document.querySelector('input[name="biomedicalPeriod"]:checked').value || 'monthly';
                const isTotal = period === 'total';
                const datasets = biomedicalData.last24Months.datasets || {};

                const validDatasets = {};
                Object.keys(datasets).forEach(key => {
                    const filteredData = datasets[key].data.filter(val => val != null);
                    if (filteredData.length) validDatasets[key] = { data: datasets[key].data, color: datasets[key].color || '#000000' };
                });

                const seriesData = isTotal
                    ? Object.values(validDatasets).map(d => d.data.reduce((a, b) => a + b, 0))
                    : Object.keys(validDatasets).map(key => ({
                        name: key,
                        data: validDatasets[key].data.map((val, i) => {
                            const total = Object.values(validDatasets).reduce((sum, d) => sum + (d.data[i] || 0), 0);
                            return total ? (val / total * 100) : 0;
                        })
                    }));

                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: isTotal ? 'pie' : 'bar',
                        stacked: !isTotal
                    },
                    series: seriesData,
                    ...(isTotal ? {
                        labels: Object.keys(validDatasets),
                        dataLabels: {
                            enabled: true,
                            formatter: val => formatNumber(val, '%'),
                            style: {
                                fontSize: '14px',
                                fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                            }
                        },
                        tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公噸') } }
                    } : {
                        xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                        yaxis: {
                            ...maximizedBaseOptions.yaxis,
                            title: { text: '百分比' },
                            min: 0,
                            max: 100,
                            labels: {
                                ...maximizedBaseOptions.yaxis.labels,
                                formatter: val => Math.floor(val)
                            }
                        },
                        tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '%') } }
                    }),
                    colors: Object.values(validDatasets).map(d => d.color)
                };
            }
            break;

        case 'lineChartBiomedicalWasteProductionTotal':
            if (biomedicalData.last24Months && Array.isArray(biomedicalData.last24Months.total)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: [{
                        name: '總產量 (公噸)',
                        data: biomedicalData.last24Months.total || []
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公噸' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公噸') } },
                    colors: ['#FFCE56']
                };
            }
            break;

        case 'lineChartDialBucketAndSoftBagProduction':
            if (biomedicalData.dialysis24Months && Array.isArray(biomedicalData.dialysis24Months.labels)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: Object.keys(biomedicalData.dialysis24Months.datasets || {}).map(key => ({
                        name: key,
                        data: biomedicalData.dialysis24Months.datasets[key].data || []
                    })),
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公斤' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公斤') } },
                    colors: Object.values(biomedicalData.dialysis24Months.datasets || {}).map(d => d.color || '#000000')
                };
            }
            break;

        case 'lineChartDialBucketAndSoftBagDisposalCosts':
            if (biomedicalData.dialysis24Months && Array.isArray(biomedicalData.dialysis24Months.costs)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: [{
                        name: '費用 (新台幣)',
                        data: biomedicalData.dialysis24Months.costs || []
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '新台幣' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => formatNumberWithCommas(Math.floor(val)) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '新台幣') } },
                    colors: ['#FF6384']
                };
            }
            break;

        case 'lineChartPharGlassProduction':
            if (pharGlassData.last24Months && Array.isArray(pharGlassData.last24Months.data)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: [{
                        name: '產量 (公斤)',
                        data: pharGlassData.last24Months.data || []
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '公斤' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => Math.floor(val) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '公斤') } },
                    colors: ['#36A2EB']
                };
            }
            break;

        case 'lineChartPharGlassDisposalCosts':
            if (pharGlassData.last24Months && Array.isArray(pharGlassData.last24Months.costs)) {
                return {
                    ...maximizedBaseOptions,
                    chart: {
                        ...maximizedBaseOptions.chart,
                        type: 'line'
                    },
                    series: [{
                        name: '費用 (新台幣)',
                        data: pharGlassData.last24Months.costs || []
                    }],
                    xaxis: { ...maximizedBaseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
                    yaxis: {
                        ...maximizedBaseOptions.yaxis,
                        title: { text: '新台幣' },
                        min: 0,
                        labels: { ...maximizedBaseOptions.yaxis.labels, formatter: val => formatNumberWithCommas(Math.floor(val)) }
                    },
                    tooltip: { ...maximizedBaseOptions.tooltip, y: { formatter: val => formatNumber(val, '新台幣') } },
                    colors: ['#FF6384']
                };
            }
            break;
    }

    return null;
}