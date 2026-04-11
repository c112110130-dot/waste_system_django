// main_menu.js
import { fetchServerTime, calculateDateRange, generateLabels } from './utils.js';
import { renderRecycleCharts, renderGeneralWasteCharts, renderBiomedicalWasteCharts, renderPharGlassCharts } from './charts.js';
import { initializeMaximizeButtons } from './chart_maximize.js';

document.addEventListener('DOMContentLoaded', async () => {

    const serverTime = await fetchServerTime();
    const { startDate, endDate } = calculateDateRange(serverTime);
    const xAxisLabels = generateLabels(startDate, endDate);

    const data = window.recycleData || {};
    const recycleData = data.recycle || {};
    const generalData = data.general || {};
    const biomedicalData = data.biomedical || {};
    const pharGlassData = data.pharGlass || {};

    // Render all charts
    renderRecycleCharts(recycleData, xAxisLabels);
    renderGeneralWasteCharts(generalData, xAxisLabels);
    renderBiomedicalWasteCharts(biomedicalData, xAxisLabels);
    renderPharGlassCharts(pharGlassData, xAxisLabels);

    // Initialize maximize buttons
    initializeMaximizeButtons();

    // Register dashboard statistics refresh if StatisticsRefresher is available
    if (window.StatisticsRefresher) {
        window.StatisticsRefresher.register('dashboard-charts', async () => {
            // Refresh dashboard charts when statistics change
            try {
                const serverTime = await fetchServerTime();
                const { startDate, endDate } = calculateDateRange(serverTime);
                const xAxisLabels = generateLabels(startDate, endDate);

                // Re-fetch data from server (assumes data is refreshed via page reload for now)
                // In a more sophisticated implementation, we would fetch new data via API
                if (window.recycleData) {
                    const data = window.recycleData;
                    renderRecycleCharts(data.recycle || {}, xAxisLabels);
                    renderGeneralWasteCharts(data.general || {}, xAxisLabels);
                    renderBiomedicalWasteCharts(data.biomedical || {}, xAxisLabels);
                    renderPharGlassCharts(data.pharGlass || {}, xAxisLabels);
                }
            } catch (error) {
                console.error('Failed to refresh dashboard charts:', error);
            }
        }, {
            strategy: window.StatisticsRefresher.STRATEGIES.DEBOUNCED,
            debounceDelay: 5000, // Charts can be slower to refresh
            triggers: [
                window.StatisticsRefresher.OPERATIONS.BATCH_CREATE,
                window.StatisticsRefresher.OPERATIONS.BATCH_UPDATE,
                window.StatisticsRefresher.OPERATIONS.BATCH_DELETE,
                window.StatisticsRefresher.OPERATIONS.IMPORT
            ]
        });
    }

    // Toggle chart sections with hex buttons
    const sections = {
        'recycleOverview': document.getElementById('recycleOverview'),
        'generalOverview': document.getElementById('generalOverview'),
        'biomedicalOverview': document.getElementById('biomedicalOverview'),
        'pharGlassOverview': document.getElementById('pharGlassOverview')
    };
    document.querySelectorAll('hex-button').forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section');
            Object.keys(sections).forEach(id => {
                if (id === sectionId) {
                    sections[id].classList.remove('has-hidden');
                } else {
                    sections[id].classList.add('has-hidden');
                }
            });
            // Hide maximized view if visible when changing sections
            document.getElementById('maximizedOverview').classList.add('has-hidden');
            button.setAttribute('active', '');
            document.querySelectorAll(`hex-button:not([data-section="${sectionId}"])`).forEach(b => b.removeAttribute('active'));
            if (sectionId === 'recycleOverview') window.updateRecycleStackedBar($('input[name="recyclePeriod"]:checked').val() || 'monthly');
            else if (sectionId === 'generalOverview') window.updateGeneralStackedBar($('input[name="generalPeriod"]:checked').val() || 'monthly');
            else if (sectionId === 'biomedicalOverview') window.updateBiomedicalStackedBar($('input[name="biomedicalPeriod"]:checked').val() || 'monthly');
        });
    });

    // Event listeners for period changes
    $('input[name="recyclePeriod"]').change(function() { window.updateRecycleStackedBar($(this).val()); });
    $('input[name="generalPeriod"]').change(function() { window.updateGeneralStackedBar($(this).val()); });
    $('input[name="biomedicalPeriod"]').change(function() { window.updateBiomedicalStackedBar($(this).val()); });
});