// Tab management for chart configurations with enhanced theme support
document.addEventListener('DOMContentLoaded', () => {
    // Check if tab management is already initialized to prevent duplicate functionality
    if (window.tabManagementInitialized) {
        return;
    }
    
    // Ensure common utilities are available
    if (!window.DOMUtils || !window.ModalUtils) {
        console.error('[Visualize Tabs] Common utilities not loaded');
        return;
    }
    
    // Detect page type based on available elements
    const isVisualizePage = !!document.getElementById('chartType');
    const isDepartmentPage = !!document.getElementById('displayType');
    
    // Skip initialization if this is not a compatible page
    if (!isVisualizePage && !isDepartmentPage) {
        console.log('[Visualize Tabs] Skipping initialization - incompatible page');
        return;
    }
    
    window.tabManagementInitialized = true;
    window.currentPageType = isVisualizePage ? 'visualize' : 'department';

    // DOM elements
    const chartList = document.getElementById('chartList');
    const addChartBtn = chartList.querySelector('.ts-button.is-positive');
    const addChartBtnContainer = addChartBtn.closest('.column.is-3-wide');
    const generateChartBtn = document.getElementById('generateChartBtn');
    const chartPreview = document.getElementById('chartPreview');

    // Create a container for sortable tabs with enhanced styling
    const sortableContainer = document.createElement('div');
    sortableContainer.id = 'sortableTabs';
    sortableContainer.className = 'ts-grid is-relaxed';
    // Insert the sortable container before the add button container
    chartList.insertBefore(sortableContainer, addChartBtnContainer);

    // Store original functionality before replacing elements
    window.originalGenerateChartClick = function() {
        // Use the global generateChart function if available
        if (typeof window.generateChart === 'function') {
            window.generateChart();
        } else {
        }
    };

    // Title tracking - dynamic sequence calculation based on current state
    // Sequences are recalculated whenever tabs change
    // First occurrence: no number displayed
    // Second occurrence: display "(1)"
    // Third occurrence: display "(2)"

    // Generate new chart title - returns empty string for auto-generation
    function generateNewChartTitle() {
        return "";
    }

    function generateAutoTitle() {
        const yAxisSelect = document.getElementById('yAxis');
        const xAxisSelect = document.getElementById('xAxis');
        const displayTypeSelect = document.getElementById('displayType');

        // Ensure elements exist and have options
        if (!yAxisSelect || !xAxisSelect ||
            !yAxisSelect.options || !xAxisSelect.options ||
            yAxisSelect.selectedIndex < 0 || xAxisSelect.selectedIndex < 0 ||
            !yAxisSelect.options[yAxisSelect.selectedIndex] ||
            !xAxisSelect.options[xAxisSelect.selectedIndex]) {
            // Fallback title for department page or when elements not ready
            return displayTypeSelect ? '部門廢棄物分析' : '廢棄物分析';
        }

        const yAxisText = (yAxisSelect.options[yAxisSelect.selectedIndex] && yAxisSelect.options[yAxisSelect.selectedIndex].text) || '數據';
        const xAxisText = (xAxisSelect.options[xAxisSelect.selectedIndex] && xAxisSelect.options[xAxisSelect.selectedIndex].text) || '時間';

        // For department page, include display type if available
        if (displayTypeSelect && displayTypeSelect.options && displayTypeSelect.selectedIndex >= 0) {
            const displayTypeText = displayTypeSelect.options[displayTypeSelect.selectedIndex].text || '分析';
            return `部門 ${yAxisText} (${xAxisText}, ${displayTypeText})`;
        }

        // For visualize page
        return `${yAxisText} vs. ${xAxisText}`;
    }

    // Recalculate sequences for all tabs with the same baseTitle
    // This ensures sequences always reflect current state
    function recalculateSequencesForTitle(baseTitle) {
        // Find all tabs with this baseTitle
        const tabsWithTitle = chartConfigurations
            .map((config, index) => ({ config, index }))
            .filter(item => item.config.baseTitle === baseTitle);

        // If only one tab, no sequence needed
        if (tabsWithTitle.length === 1) {
            const item = tabsWithTitle[0];
            item.config.sequence = 0;
            item.config.displayTitle = baseTitle;
        }
        // Multiple tabs: assign sequences starting from 0
        else if (tabsWithTitle.length > 1) {
            tabsWithTitle.forEach((item, positionIndex) => {
                item.config.sequence = positionIndex;
                item.config.displayTitle = positionIndex === 0 ?
                    baseTitle :
                    `${baseTitle} (${positionIndex})`;
            });
        }

        // Update DOM to reflect the new display titles
        updateAllTabTitlesDisplay();
    }

    // Recalculate all sequences for all tabs
    // Call this after any change that might affect sequences
    function recalculateAllSequences() {
        // Group tabs by baseTitle
        const titleGroups = {};

        chartConfigurations.forEach((config, index) => {
            const baseTitle = config.baseTitle;
            if (!titleGroups[baseTitle]) {
                titleGroups[baseTitle] = [];
            }
            titleGroups[baseTitle].push({ config, index });
        });

        // Recalculate sequences for each group
        Object.keys(titleGroups).forEach(baseTitle => {
            const group = titleGroups[baseTitle];

            if (group.length === 1) {
                // Only one tab with this title: no sequence
                group[0].config.sequence = 0;
                group[0].config.displayTitle = baseTitle;
            } else {
                // Multiple tabs: assign sequences
                group.forEach((item, positionIndex) => {
                    item.config.sequence = positionIndex;
                    item.config.displayTitle = positionIndex === 0 ?
                        baseTitle :
                        `${baseTitle} (${positionIndex})`;
                });
            }
        });

        // Update DOM
        updateAllTabTitlesDisplay();
    }

    // Helper function to safely get element value
    function safeGetElementValue(id, defaultValue) {
        const element = document.getElementById(id);
        return element ? element.value : defaultValue;
    }

    // Helper function to safely get checkbox value
    function safeGetCheckboxValue(id, defaultValue) {
        const element = document.getElementById(id);
        return element ? element.checked : defaultValue;
    }

    // Initialize with empty title for auto-generation
    const defaultTitle = generateNewChartTitle();
    const autoTitle = generateAutoTitle();

    // Store chart configurations for each tab with enhanced theme support
    let chartConfigurations = [{
        title: defaultTitle,
        baseTitle: autoTitle,
        displayTitle: autoTitle, // Will be recalculated by recalculateAllSequences()
        sequence: 0, // Will be recalculated
        chartType: safeGetElementValue('chartType', 'bar'),
        yAxis: safeGetElementValue('yAxis', 'metric_ton'),
        xAxis: safeGetElementValue('xAxis', 'year_sum'),
        displayType: safeGetElementValue('displayType', 'separate'), // For department pages
        datasets: [],
        showValues: safeGetCheckboxValue('showValues', false),
        showFullGrid: safeGetCheckboxValue('showFullGrid', false),
        includeTable: safeGetCheckboxValue('includeTable', false),
        chartContent: null,
        chartOptions: null,
        hasGeneratedChart: false,
        colorIndex: 0 // Store colorIndex for each tab
    }];

    let activeTabIndex = 0;

    // Set global activeTabIndex for other modules to access
    window.activeTabIndex = activeTabIndex;

    // Initialize Sortable on the tab container with enhanced theme support
    let sortableList;
    function initializeSortable() {
        if (sortableList) {
            sortableList.destroy();
        }

        sortableList = new Sortable(sortableContainer, {
            animation: 150,
            handle: '.chart-tab-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: function(evt) {
                // Get the new positions and update configurations
                reorderConfigurations(evt.oldIndex, evt.newIndex);
            }
        });
    }

    // Reorder configurations after drag and drop with enhanced state management
    function reorderConfigurations(oldIndex, newIndex) {
        // Save current configuration first
        saveCurrentConfiguration();

        // Move the configuration to the new position
        const movedConfig = chartConfigurations.splice(oldIndex, 1)[0];
        chartConfigurations.splice(newIndex, 0, movedConfig);

        // Update active tab index if it's the one being moved
        if (activeTabIndex === oldIndex) {
            activeTabIndex = newIndex;
            window.activeTabIndex = newIndex;
        }
        // Update active tab index if it's affected by the move
        else if (oldIndex < activeTabIndex && newIndex >= activeTabIndex) {
            activeTabIndex--;
            window.activeTabIndex = activeTabIndex;
        } else if (oldIndex > activeTabIndex && newIndex <= activeTabIndex) {
            activeTabIndex++;
            window.activeTabIndex = activeTabIndex;
        }

        // Update all tab elements with new indices
        updateTabIndices();

        // Update tab title displays - don't reassign numbers
        updateAllTabTitlesDisplay();
    }

    // Update tab indices after reordering with enhanced visual feedback
    function updateTabIndices() {
        const tabs = sortableContainer.querySelectorAll('.column.ts-box');
        tabs.forEach((tab, index) => {
            tab.dataset.tabIndex = index;

            // Update active state with enhanced styling
            if (index === activeTabIndex) {
                tab.classList.add('background-tertiary');
                tab.style.transform = 'scale(1.02)';
                tab.style.transition = 'all 0.2s ease';
            } else {
                tab.classList.remove('background-tertiary');
                tab.style.transform = 'scale(1)';
                tab.style.transition = 'all 0.2s ease';
            }
        });
    }


    // Initialize with first tab and enhanced theme support
    initializeTabs();
    initializeSortable();

    // Preserve original add button functionality but add our own behavior
    addChartBtn.addEventListener('click', addNewTab);

    // Chart title input event handling with enhanced functionality
    const chartTitleInput = document.getElementById('chartTitle');

    // Set initial placeholder
    chartTitleInput.placeholder = generateAutoTitle();

    chartTitleInput.addEventListener('input', function() {
        const title = this.value.trim();

        if (!title) {
            // Empty input: clear stored title and show auto-generated title
            const config = chartConfigurations[activeTabIndex];
            if (config) {
                // Clear stored title
                config.title = '';

                // Generate auto title for display (but don't change baseTitle or sequence yet)
                const autoTitle = generateAutoTitle();
                this.placeholder = autoTitle;

                // Just update the tab display to show auto-generated title
                // The actual baseTitle and sequence will be updated in updateTabDisplayTitle
                updateTabDisplayTitle(activeTabIndex, autoTitle);
            }
        } else {
            // Has input: save to configuration and update tab display
            updateTabTitle(activeTabIndex, title);
            this.placeholder = generateAutoTitle(); // Reset placeholder to auto-generated
        }
    });

    // Update placeholder when Y-axis or X-axis changes with enhanced responsiveness
    const yAxisSelect = document.getElementById('yAxis');
    const xAxisSelect = document.getElementById('xAxis');

    function updatePlaceholder() {
        const chartTitleInput = document.getElementById('chartTitle');
        if (!chartTitleInput.value.trim()) {
            const autoTitle = generateAutoTitle();
            chartTitleInput.placeholder = autoTitle;
            // Update tab display title but don't change stored title
            updateTabDisplayTitle(activeTabIndex, autoTitle);
        }
    }

    yAxisSelect.addEventListener('change', updatePlaceholder);
    xAxisSelect.addEventListener('change', updatePlaceholder);

    // Initialize with at least one tab
    function initializeTabs() {
        // Clear the sortable container
        DOMUtils.clearElement(sortableContainer);

        // Create tabs from configurations with enhanced styling
        chartConfigurations.forEach((config, index) => {
            createTabElement(config.displayTitle || 'Untitled Chart', index);
        });

        // Update visual state only, DO NOT call setActiveTab() here
        // setActiveTab() would trigger saveCurrentConfiguration() which reads from DOM
        // At this point DOM might contain stale data
        const tabs = sortableContainer.querySelectorAll('.column.ts-box');
        tabs.forEach(tab => {
            const tabIndex = parseInt(tab.dataset.tabIndex);
            if (tabIndex === activeTabIndex) {
                tab.classList.add('background-tertiary');
                tab.style.transform = 'scale(1.02)';
                tab.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            } else {
                tab.classList.remove('background-tertiary');
                tab.style.transform = 'scale(1)';
                tab.style.boxShadow = '';
            }
        });
    }

    // Add a new tab with default values and enhanced animation
    function addNewTab() {
        const newIndex = chartConfigurations.length;
        const defaultTitle = generateNewChartTitle(); // Empty string for auto-generation
        const autoTitle = generateAutoTitle();

        // Create new configuration with DEFAULT values, not current DOM values
        // Use page-specific defaults
        const defaultXAxis = window.currentPageType === 'department' ? 'year_sum' : 'month';
        const defaultDisplayType = window.currentPageType === 'department' ? 'separate' : undefined;

        const newConfig = {
            title: defaultTitle,
            baseTitle: autoTitle,
            displayTitle: autoTitle, // Will be recalculated
            sequence: 0, // Will be recalculated
            chartType: 'bar', // Default chart type
            yAxis: 'metric_ton', // Default Y-axis
            xAxis: defaultXAxis, // Page-specific default X-axis
            datasets: [],
            showValues: false, // Default value
            showFullGrid: false, // Default value
            includeTable: false, // Default value
            chartContent: null,
            chartOptions: null,
            hasGeneratedChart: false,
            colorIndex: 0, // Initialize colorIndex for the new tab
            // System metadata for unified API interface
            systemType: window.currentPageType === 'department' ? 'department' : 'visualize',
            apiEndpoint: window.currentPageType === 'department' ?
                '/management/api/visualize_dept/data/' : '/management/visualize/'
        };

        // Add department-specific field if applicable
        if (window.currentPageType === 'department') {
            newConfig.displayType = defaultDisplayType;
        }

        chartConfigurations.push(newConfig);

        // Recalculate sequences for all tabs
        recalculateAllSequences();

        // Create tab element with correct display title
        createTabElement(newConfig.displayTitle, newIndex);

        // Set as active with smooth transition
        setActiveTab(newIndex);
    }

    // Create a tab element with given title and index with enhanced styling
    function createTabElement(title, index) {
        // Create tab element with enhanced styling
        const tabElement = document.createElement('div');
        tabElement.className = 'column ts-box is-4-wide is-raised has-padded';
        if (index === activeTabIndex) {
            tabElement.classList.add('background-tertiary');
        }
        tabElement.dataset.tabIndex = index;

        // styling with theme support
        tabElement.style.transition = 'all 0.3s ease';
        tabElement.style.cursor = 'pointer';

        // Create tab content safely
        const grid = DOMUtils.createElement(tabElement, 'div', { class: 'ts-grid is-relaxed' });
        
        DOMUtils.createElement(grid, 'div', { class: 'column is-1-wide ts-icon is-bars-icon is-large chart-tab-handle' });
        
        const titleColumn = DOMUtils.createElement(grid, 'div', { class: 'column is-fluid ts-text is-fluid is-bold tab-title' });
        titleColumn.textContent = title;
        
        const removeColumn = DOMUtils.createElement(grid, 'div', { class: 'column is-4-wide ts-button is-icon is-outlined is-negative is-critical remove-tab-btn' });
        DOMUtils.createElement(removeColumn, 'span', { class: 'ts-icon is-xmark-icon' });

        // Add entrance animation
        tabElement.style.opacity = '0';
        tabElement.style.transform = 'translateY(-10px)';

        // Append to the sortable container
        sortableContainer.appendChild(tabElement);

        // Trigger entrance animation
        setTimeout(() => {
            tabElement.style.opacity = '1';
            tabElement.style.transform = 'translateY(0)';
        }, 10);

        // Add enhanced event listeners
        tabElement.addEventListener('click', function(e) {
            if (!e.target.closest('.remove-tab-btn') && !e.target.closest('.chart-tab-handle')) {
                setActiveTab(parseInt(tabElement.dataset.tabIndex));
            }
        });

        // Add hover effects
        tabElement.addEventListener('mouseenter', function() {
            if (parseInt(this.dataset.tabIndex) !== activeTabIndex) {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }
        });

        tabElement.addEventListener('mouseleave', function() {
            if (parseInt(this.dataset.tabIndex) !== activeTabIndex) {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '';
            }
        });

        const removeBtn = tabElement.querySelector('.remove-tab-btn');
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            removeTab(parseInt(tabElement.dataset.tabIndex));
        });
    }

    // chart cleanup function - avoid infinite recursion
    function cleanupChart() {
        try {
            // Direct cleanup without calling global function to avoid recursion
            if (window.chart) {
                window.chart.destroy();
                window.chart = null;
            }

            // Remove any ApexCharts elements directly with enhanced cleanup
            const chartElements = document.querySelectorAll('.apexcharts-canvas, .apexcharts-svg, .apexcharts-inner, .apexcharts-graphical, .apexcharts-datalabels, .apexcharts-legend, .apexcharts-tooltip');
            chartElements.forEach(el => {
                try {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                } catch (e) {
                }
            });

            // Clear chart preview area
            DOMUtils.clearElement(chartPreview);

            // Clear data table
            const currentDataTable = document.getElementById('dataTable');
            if (currentDataTable) {
                DOMUtils.clearElement(currentDataTable);
            }

            window.chartData = null;
        } catch (e) {
        }
    }

    // Reset preview background theme and clear cache before switching tabs
    function resetPreviewThemeAndCache() {
        try {
            // Clear any cached chart data and references
            window.chartData = null;
            window.departmentChartData = null;

            // Reset global color index
            if (typeof window.globalColorIndex !== 'undefined') {
                window.globalColorIndex = 0;
            }

            // Hide charts and tables when switching tabs
            const chartPreview = document.getElementById('chartPreview');
            const dataTable = document.getElementById('dataTable');

            if (chartPreview) {
                chartPreview.classList.add('has-hidden');
            }

            if (dataTable) {
                dataTable.classList.add('has-hidden');
            }

            // Reset preview background to match current theme setting
            const chartPreviewDisplayArea = document.getElementById('chartPreviewDisplayArea');
            if (chartPreviewDisplayArea) {
                // Force remove any theme-related classes
                chartPreviewDisplayArea.classList.remove('has-inverted-preview-background');

                // Trigger a fresh theme update
                if (window.VisualizeChartUtils && typeof window.VisualizeChartUtils.updatePreviewBackground === 'function') {
                    setTimeout(() => {
                        window.VisualizeChartUtils.updatePreviewBackground();
                    }, 10);
                } else if (typeof window.updatePreviewBackground === 'function') {
                    setTimeout(() => {
                        window.updatePreviewBackground();
                    }, 10);
                }
            }

            // Clear any theme-related cache - reuse dataTable variable from above
            if (dataTable) {
                // Reset table theme classes
                dataTable.classList.remove('is-dark', 'is-light');

                // Find and reset table wrapper theme
                const dataTableWrapper = document.querySelector('.ts-box:has(> #dataTable)');
                if (dataTableWrapper) {
                    dataTableWrapper.classList.remove('is-dark', 'is-light');
                }
            }

            console.log('[Visualize Tabs] Preview theme and cache reset completed');

        } catch (error) {
            console.error('[Visualize Tabs] Error during preview theme and cache reset:', error);
        }
    }

    // Remove a tab by index with enhanced animation and confirmation
    function removeTab(index) {
        // Don't remove if it's the last tab
        if (chartConfigurations.length <= 1) {
            showErrorModal('至少需要保留一個圖表');
            return;
        }

        // Special handling for the case with only two tabs
        if (chartConfigurations.length === 2) {
            // When we have only two tabs, always save the tab that's NOT being deleted
            const remainingTabIndex = index === 0 ? 1 : 0;
            const remainingConfig = JSON.parse(JSON.stringify(chartConfigurations[remainingTabIndex]));

            // Clean up chart before removing tab
            cleanupChart();

            // Get the title and sequence before removing
            const removedBaseTitle = chartConfigurations[index].baseTitle;
            const removedSequence = chartConfigurations[index].sequence;

            // Add removal animation
            const tabToRemove = sortableContainer.querySelector(`[data-tab-index="${index}"]`);
            if (tabToRemove) {
                tabToRemove.style.transition = 'all 0.3s ease';
                tabToRemove.style.opacity = '0';
                tabToRemove.style.transform = 'translateX(-20px)';
            }

            setTimeout(() => {
                // Reset form fields FIRST to prevent data leakage
                resetFormFields();

                // Remove configuration of the tab being deleted
                chartConfigurations.splice(index, 1);

                // After deletion, there's only one tab left at index 0
                activeTabIndex = 0;
                window.activeTabIndex = 0;

                // Reinitialize tabs and sortable
                initializeTabs();
                initializeSortable();

                // Restore the saved configuration to the remaining tab
                chartConfigurations[0] = remainingConfig;

                // Recalculate all sequences after deletion
                recalculateAllSequences();

                // Load the clean configuration
                loadConfiguration(0);

                // Trigger UI updates
                const chartType = document.getElementById('chartType');
                const yAxis = document.getElementById('yAxis');
                const xAxis = document.getElementById('xAxis');

                if (chartType) $(chartType).trigger('change');
                if (yAxis) $(yAxis).trigger('change');
                if (xAxis) $(xAxis).trigger('change');

                // Update data inputs
                if (typeof updateDataInputs === 'function') {
                    updateDataInputs(xAxis.value, yAxis.value, window.visualizeConfig?.fields || {});
                }
            }, 300);

            return;
        }

        // Standard handling for more than two tabs with enhanced animation
        // Determine the new active tab index before removing the tab
        let newActiveIndex = activeTabIndex;
        if (activeTabIndex === index) {
            // If removing the active tab, switch to the previous tab
            newActiveIndex = Math.max(0, index - 1);
        } else if (activeTabIndex > index) {
            // If removing a tab before the active one, adjust the index
            newActiveIndex = activeTabIndex - 1;
        }

        // Get the title and sequence before removing
        const removedBaseTitle = chartConfigurations[index].baseTitle;
        const removedSequence = chartConfigurations[index].sequence;

        // Add removal animation
        const tabToRemove = sortableContainer.querySelector(`[data-tab-index="${index}"]`);
        if (tabToRemove) {
            tabToRemove.style.transition = 'all 0.3s ease';
            tabToRemove.style.opacity = '0';
            tabToRemove.style.transform = 'translateX(-20px)';
        }

        setTimeout(() => {
            // Clean up chart before removing tab
            cleanupChart();

            // Reset form fields FIRST to prevent data leakage from deleted tab
            resetFormFields();

            // Remove configuration of the tab being deleted
            chartConfigurations.splice(index, 1);

            // Update active tab index
            activeTabIndex = newActiveIndex;
            window.activeTabIndex = activeTabIndex;

            // Reinitialize tabs
            initializeTabs();

            // Reinitialize sortable after rebuilding tabs
            initializeSortable();

            // Recalculate all sequences after deletion
            recalculateAllSequences();

            // Load the configuration for the new active tab
            if (activeTabIndex < chartConfigurations.length) {
                loadConfiguration(activeTabIndex);

                // Manually trigger updates for components that need to be refreshed
                const chartType = document.getElementById('chartType');
                const yAxis = document.getElementById('yAxis');
                const xAxis = document.getElementById('xAxis');

                if (chartType) $(chartType).trigger('change');
                if (yAxis) $(yAxis).trigger('change');
                if (xAxis) $(xAxis).trigger('change');

                // Update data inputs for proper display after tab switch
                if (typeof updateDataInputs === 'function') {
                    updateDataInputs(xAxis.value, yAxis.value, window.visualizeConfig?.fields || {});
                }
            }
        }, 300);
    }

    // Helper function to reset form fields to default state
    function resetFormFields() {
        // Reset chart title to empty for auto-generation
        document.getElementById('chartTitle').value = '';

        // Clear datasets list
        const dataList = document.getElementById('dataList');
        if (dataList) {
            DOMUtils.clearElement(dataList);
        }

        // Reset other form elements to default values
        document.getElementById('showValues').checked = false;
        document.getElementById('showFullGrid').checked = false;
        document.getElementById('includeTable').checked = false;
    }

    // Set active tab - improved Y-axis switching synchronization with enhanced animation and thorough cleanup
    function setActiveTab(index) {
        // CRITICAL FIX: Save current configuration BEFORE cleanup
        // This ensures chart content is preserved before DOM is cleared
        saveCurrentConfiguration();

        // cleanup after saving
        cleanupChart();

        // Reset preview background theme and clear cache before switching tabs
        resetPreviewThemeAndCache();

        // Update active index
        activeTabIndex = index;
        window.activeTabIndex = index; // Update global reference

        // Update UI with enhanced visual feedback
        const tabs = sortableContainer.querySelectorAll('.column.ts-box');
        tabs.forEach(tab => {
            const tabIndex = parseInt(tab.dataset.tabIndex);
            tab.style.transition = 'all 0.3s ease';

            if (tabIndex === index) {
                tab.classList.add('background-tertiary');
                tab.style.transform = 'scale(1.02)';
                tab.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            } else {
                tab.classList.remove('background-tertiary');
                tab.style.transform = 'scale(1)';
                tab.style.boxShadow = '';
            }
        });

        // Load configuration - delayed loading to ensure DOM updates complete
        setTimeout(() => {
            loadConfiguration(index);
        }, 10);
    }

    // Update tab title and stored configuration with enhanced validation
    function updateTabTitle(index, newTitle) {
        if (index >= 0 && index < chartConfigurations.length) {
            const config = chartConfigurations[index];
            const oldBaseTitle = config.baseTitle;

            // Check if base title has changed - strip any numbering
            const baseTitle = newTitle.replace(/\s*\(\d+\)$/, '').trim();

            // Update configuration
            config.title = newTitle;
            config.baseTitle = baseTitle;

            if (baseTitle !== oldBaseTitle) {
                // Title base has changed - recalculate sequences for both old and new titles
                if (oldBaseTitle) {
                    recalculateSequencesForTitle(oldBaseTitle);
                }
                recalculateSequencesForTitle(baseTitle);
            } else {
                // Base title didn't change, but still recalculate in case of duplicates
                recalculateSequencesForTitle(baseTitle);
            }
        }
    }

    // Update only tab display without changing stored configuration
    function updateTabDisplayTitle(index, displayTitle) {
        if (index >= 0 && index < chartConfigurations.length) {
            const config = chartConfigurations[index];

            // If this is an auto-generated title and stored title is empty, handle sequencing
            if ((!config.title || config.title.trim() === '') && displayTitle) {
                // Check if we need to update the base title for sequencing
                const baseTitle = displayTitle.replace(/\s*\(\d+\)$/, '').trim();

                // Only update base title if it's different (for axis changes)
                if (baseTitle !== config.baseTitle) {
                    const oldBaseTitle = config.baseTitle;

                    // Update configuration
                    config.baseTitle = baseTitle;

                    // Recalculate sequences for both old and new base titles
                    if (oldBaseTitle) {
                        recalculateSequencesForTitle(oldBaseTitle);
                    }
                    recalculateSequencesForTitle(baseTitle);
                    return;
                }
            }

            // Update only the visual display for this specific tab with animation
            const tabs = sortableContainer.querySelectorAll('.column.ts-box');
            const targetTab = tabs[index];
            if (targetTab) {
                const titleElement = targetTab.querySelector('.tab-title');
                if (titleElement) {
                    // Use the stored displayTitle if available, otherwise use the provided displayTitle
                    const finalDisplayTitle = config.displayTitle || displayTitle;

                    // Add smooth text transition
                    titleElement.style.transition = 'opacity 0.2s ease';
                    titleElement.style.opacity = '0.5';

                    setTimeout(() => {
                        titleElement.textContent = finalDisplayTitle;
                        titleElement.style.opacity = '1';
                    }, 100);
                }
            }
        }
    }

    // Only update the display of titles based on current configuration with enhanced animation
    function updateAllTabTitlesDisplay() {
        const tabs = sortableContainer.querySelectorAll('.column.ts-box');
        tabs.forEach(tab => {
            const index = parseInt(tab.dataset.tabIndex);
            if (index >= 0 && index < chartConfigurations.length) {
                const displayTitle = chartConfigurations[index].displayTitle;
                const titleElement = tab.querySelector('.tab-title');
                if (titleElement && titleElement.textContent !== displayTitle) {
                    // Add smooth text transition
                    titleElement.style.transition = 'opacity 0.2s ease';
                    titleElement.style.opacity = '0.5';

                    setTimeout(() => {
                        titleElement.textContent = displayTitle;
                        titleElement.style.opacity = '1';
                    }, 100);
                }
            }
        });
    }

    // Save current chart configuration with enhanced data preservation
    function saveCurrentConfiguration() {
        if (activeTabIndex >= 0 && activeTabIndex < chartConfigurations.length) {
            // Save chart content if it exists
            if (window.chart && !chartConfigurations[activeTabIndex].hasGeneratedChart) {
                chartConfigurations[activeTabIndex].hasGeneratedChart = true;
            }

            // Store chart content DOM using safe methods
            if (chartPreview) {
                chartConfigurations[activeTabIndex].chartContent = {
                    chart: chartPreview.cloneNode(true),
                    table: document.getElementById('dataTable')?.cloneNode(true)
                };
            }

            // Store chart options if available
            if (window.chart && window.chart.opts) {
                try {
                    chartConfigurations[activeTabIndex].chartOptions = JSON.parse(JSON.stringify(window.chart.opts));
                } catch (e) {
                }
            }

            // Store chart data
            if (window.chartData) {
                try {
                    chartConfigurations[activeTabIndex].chartData = JSON.parse(JSON.stringify(window.chartData));
                } catch (e) {
                }
            }

            // Preserve colorIndex as well
            if (typeof window.globalColorIndex !== 'undefined') {
                chartConfigurations[activeTabIndex].colorIndex = window.globalColorIndex;
            }

            // Get current settings (maintaining title properties)
            const currentConfig = chartConfigurations[activeTabIndex];
            chartConfigurations[activeTabIndex] = {
                ...currentConfig,
                chartType: safeGetElementValue('chartType', currentConfig.chartType || 'bar'),
                yAxis: safeGetElementValue('yAxis', currentConfig.yAxis || 'metric_ton'),
                xAxis: safeGetElementValue('xAxis', currentConfig.xAxis || 'year_sum'),
                displayType: safeGetElementValue('displayType', currentConfig.displayType || 'separate'),
                datasets: getDatasets(), // Get current datasets
                showValues: safeGetCheckboxValue('showValues', currentConfig.showValues || false),
                showFullGrid: safeGetCheckboxValue('showFullGrid', currentConfig.showFullGrid || false),
                includeTable: safeGetCheckboxValue('includeTable', currentConfig.includeTable || false)
            };
        }
    }

    // Load configuration for a specific tab - enhanced loading sequence with better theme handling
    function loadConfiguration(index) {
        if (index >= 0 && index < chartConfigurations.length) {
            const config = chartConfigurations[index];

            // cleanup of any existing chart
            cleanupChart();

            // Set basic form values first
            const titleInput = document.getElementById('chartTitle');
            titleInput.value = config.title || '';

            // Set chart type FIRST and update Y-axis options BEFORE setting Y-axis value
            const chartTypeElement = document.getElementById('chartType');
            if (chartTypeElement) {
                chartTypeElement.value = config.chartType;
                // Manually call updateYAxisOptions to ensure options are filtered BEFORE setting value
                if (typeof window.updateYAxisOptions === 'function') {
                    window.updateYAxisOptions();
                }
            }

            // Set axis values AFTER Y-axis options are updated
            setTimeout(() => {
                const yAxisSelect = document.getElementById('yAxis');
                const xAxisSelect = document.getElementById('xAxis');
                const displayTypeSelect = document.getElementById('displayType');

                // Set axis values after options are updated (if elements exist)
                if (yAxisSelect) yAxisSelect.value = config.yAxis;
                if (xAxisSelect) xAxisSelect.value = config.xAxis;
                if (displayTypeSelect) displayTypeSelect.value = config.displayType;

                // Set other options (if elements exist)
                const showValuesElement = document.getElementById('showValues');
                const showFullGridElement = document.getElementById('showFullGrid');
                const includeTableElement = document.getElementById('includeTable');
                
                if (showValuesElement) showValuesElement.checked = config.showValues;
                if (showFullGridElement) showFullGridElement.checked = config.showFullGrid;
                if (includeTableElement) includeTableElement.checked = config.includeTable;

                // Restore color index for this tab
                if (typeof config.colorIndex !== 'undefined') {
                    window.globalColorIndex = config.colorIndex;
                }

                // Trigger Y-axis and X-axis changes
                $(yAxisSelect).trigger('change');
                $(xAxisSelect).trigger('change');

                // Handle title display AFTER axis values are set
                setTimeout(() => {
                    if (!config.title || config.title.trim() === '') {
                        const autoTitle = generateAutoTitle();
                        titleInput.placeholder = autoTitle;
                        // Update tab display but keep stored title empty
                        updateTabDisplayTitle(index, autoTitle);
                    } else {
                        titleInput.placeholder = generateAutoTitle();
                        // Title has value, display it in tab
                        updateTabDisplayTitle(index, config.title);
                    }
                }, 10);

                // Load datasets after all axis updates
                setTimeout(() => {
                    loadDatasets(config.datasets);
                }, 25);
            }, 25);

            // Load chart content if already generated with enhanced theme awareness
            if (config.hasGeneratedChart && config.chartContent) {
                // DO NOT show chart preview when loading tab - it should stay hidden until user clicks generate
                // Charts and tables should only be visible after user clicks "生成圖表"

                // Store chart data for when user regenerates
                if (config.chartData) {
                    window.chartData = config.chartData;
                }

                // DO NOT restore chart or table display - they should remain hidden
                // The chart and table will be shown only when user clicks "生成圖表" button

                // DO NOT recreate chart automatically - charts should only be visible after user clicks generate button
            }
        }
    }

    // Helper function to collect current datasets - page-aware
    function getDatasets() {
        const dataBoxes = document.querySelectorAll('#dataList .ts-box');
        
        // Detect if this is a department page
        if (window.currentPageType === 'department') {
            // Department page dataset collection
            return Array.from(dataBoxes).map(box => {
                let startDate, endDate;
                const xAxisValue = document.getElementById('xAxis')?.value || 'year_sum';

                if (xAxisValue.startsWith('quarter')) {
                    const startYear = box.querySelector('.start-date-year')?.value;
                    const startQuarter = box.querySelector('.start-date-quarter')?.value;
                    const endYear = box.querySelector('.end-date-year')?.value;
                    const endQuarter = box.querySelector('.end-date-quarter')?.value;
                    startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
                    endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
                } else {
                    startDate = box.querySelector('.start-date')?.value || '';
                    endDate = box.querySelector('.end-date')?.value || '';
                }

                const colorInput = box.querySelector('.color-picker');
                const wasteTypeSelect = box.querySelector('.waste-type-select');
                const rankingTypeSelect = box.querySelector('.ranking-type-select');
                const rankingCountInput = box.querySelector('.ranking-count-input');

                return {
                    waste_type_id: wasteTypeSelect?.value || '',
                    name: box.querySelector('.data-name')?.value || '',
                    startDate: startDate,
                    endDate: endDate,
                    ranking_type: rankingTypeSelect?.value || 'most',
                    ranking_count: rankingCountInput?.value || '',
                    color: colorInput?.value || '#000000'
                };
            });
        } else {
            // Standard visualize page dataset collection
            return Array.from(dataBoxes).map(box => {
                const fieldSelect = box.querySelector('.data-field');
                const [table, field] = fieldSelect && fieldSelect.value ? fieldSelect.value.split(':') : ['', ''];

                let startDate, endDate;
                const xAxisValue = document.getElementById('xAxis')?.value || 'month';

                if (xAxisValue.startsWith('quarter')) {
                    const startYear = box.querySelector('.start-date-year')?.value;
                    const startQuarter = box.querySelector('.start-date-quarter')?.value;
                    const endYear = box.querySelector('.end-date-year')?.value;
                    const endQuarter = box.querySelector('.end-date-quarter')?.value;
                    startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
                    endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
                } else {
                    startDate = box.querySelector('.start-date')?.value || '';
                    endDate = box.querySelector('.end-date')?.value || '';
                }

                const colorInput = box.querySelector('.color-picker');

                return {
                    field: fieldSelect?.value || '',
                    name: box.querySelector('.data-name')?.value || '',
                    startDate: startDate,
                    endDate: endDate,
                    color: colorInput?.value || '#000000'
                };
            });
        }
    }

    // Helper function to load datasets with enhanced visual feedback and proper cleanup
    function loadDatasets(datasets) {
        // Clear existing datasets completely
        const dataList = document.getElementById('dataList');

        // Remove all children using DOM API
        while (dataList.firstChild) {
            dataList.removeChild(dataList.firstChild);
        }

        // Force clear element as backup
        DOMUtils.clearElement(dataList);

        // Verify complete cleanup
        if (dataList.children.length > 0) {
            console.error('[Tabs] Failed to clear dataList completely');
            return;
        }

        // If no datasets or empty datasets array, don't add any
        if (!datasets || datasets.length === 0) {
            return;
        }

        // Add each dataset with staggered animation - page-aware
        datasets.forEach((dataset, index) => {
            setTimeout(() => {
                if (window.currentPageType === 'department') {
                    // Department page - use addDepartmentDataRow
                    if (typeof window.addDepartmentDataRow === 'function') {
                        window.addDepartmentDataRow();

                        // Find the just-added row (should be the last one)
                        const dataBoxes = document.querySelectorAll('#dataList .ts-box');
                        const row = dataBoxes[dataBoxes.length - 1];

                        if (row) {
                            // Set department-specific fields
                            const wasteTypeSelect = row.querySelector('.waste-type-select');
                            if (wasteTypeSelect && dataset.waste_type_id) {
                                wasteTypeSelect.value = dataset.waste_type_id;
                                $(wasteTypeSelect).trigger('change');
                            }

                            const rankingTypeSelect = row.querySelector('.ranking-type-select');
                            if (rankingTypeSelect && dataset.ranking_type) {
                                rankingTypeSelect.value = dataset.ranking_type;
                            }

                            const rankingCountInput = row.querySelector('.ranking-count-input');
                            if (rankingCountInput && dataset.ranking_count) {
                                rankingCountInput.value = dataset.ranking_count;
                            }

                            const nameInput = row.querySelector('.data-name');
                            if (nameInput) {
                                nameInput.value = dataset.name || '';
                            }

                            const colorInput = row.querySelector('.color-picker');
                            if (colorInput && dataset.color) {
                                colorInput.value = dataset.color;
                                colorInput.style.backgroundColor = dataset.color;
                            }

                            // Set dates based on X-axis type
                            const xAxisValue = document.getElementById('xAxis')?.value || 'year_sum';
                            if (xAxisValue.startsWith('quarter')) {
                                const [startYear, startQuarter] = dataset.startDate ? dataset.startDate.split('-') : ['', ''];
                                const [endYear, endQuarter] = dataset.endDate ? dataset.endDate.split('-') : ['', ''];

                                const startYearInput = row.querySelector('.start-date-year');
                                if (startYearInput) startYearInput.value = startYear || '';

                                const startQuarterInput = row.querySelector('.start-date-quarter');
                                if (startQuarterInput) startQuarterInput.value = startQuarter || '';

                                const endYearInput = row.querySelector('.end-date-year');
                                if (endYearInput) endYearInput.value = endYear || '';

                                const endQuarterInput = row.querySelector('.end-date-quarter');
                                if (endQuarterInput) endQuarterInput.value = endQuarter || '';
                            } else {
                                const startDateInput = row.querySelector('.start-date');
                                if (startDateInput) startDateInput.value = dataset.startDate || '';

                                const endDateInput = row.querySelector('.end-date');
                                if (endDateInput) endDateInput.value = dataset.endDate || '';
                            }
                        }
                    }
                } else {
                    // Standard visualize page - use addDataRow
                    if (typeof addDataRow === 'function') {
                        const fields = window.visualizeConfig ? window.visualizeConfig.fields : {};
                        addDataRow(fields, dataset.color);

                        // Find the just-added row (should be the last one)
                        const dataBoxes = document.querySelectorAll('#dataList .ts-box');
                        const row = dataBoxes[dataBoxes.length - 1];

                        if (row) {
                            const fieldSelect = row.querySelector('.data-field');
                            if (fieldSelect && dataset.field) {
                                fieldSelect.value = dataset.field;
                                $(fieldSelect).trigger('change');
                            }

                            const nameInput = row.querySelector('.data-name');
                            if (nameInput) {
                                nameInput.value = dataset.name || '';
                            }

                            // Set dates based on X-axis type
                            const xAxisValue = document.getElementById('xAxis')?.value || 'month';
                            if (xAxisValue.startsWith('quarter')) {
                                const [startYear, startQuarter] = dataset.startDate ? dataset.startDate.split('-') : ['', ''];
                                const [endYear, endQuarter] = dataset.endDate ? dataset.endDate.split('-') : ['', ''];

                                const startYearInput = row.querySelector('.start-date-year');
                                if (startYearInput) startYearInput.value = startYear || '';

                                const startQuarterInput = row.querySelector('.start-date-quarter');
                                if (startQuarterInput) startQuarterInput.value = startQuarter || '';

                                const endYearInput = row.querySelector('.end-date-year');
                                if (endYearInput) endYearInput.value = endYear || '';

                                const endQuarterInput = row.querySelector('.end-date-quarter');
                                if (endQuarterInput) endQuarterInput.value = endQuarter || '';
                            } else {
                                const startDateInput = row.querySelector('.start-date');
                                if (startDateInput) startDateInput.value = dataset.startDate || '';

                                const endDateInput = row.querySelector('.end-date');
                                if (endDateInput) endDateInput.value = dataset.endDate || '';
                            }
                        }
                    }
                }
            }, index * 50); // Reduced stagger time for better performance
        });
    }

    // Show error modal with a custom message
    function showErrorModal(message) {
        if (window.GlobalModalManager && typeof window.GlobalModalManager.alert === 'function') {
            window.GlobalModalManager.alert('錯誤', message, 'error');
        } else if (window.ModalUtils && typeof window.ModalUtils.showAlert === 'function') {
            window.ModalUtils.showAlert('錯誤', message, 'error');
        } else {
            console.log('Modal systems not available, falling back to alert');
            alert(message);
        }
    }

    // generateTableHtml function to ensure proper configuration passing
    window.generateTableHtmlForCurrentChart = function(data) {
        // Get current chart configuration
        const currentChartConfig = chartConfigurations &&
            typeof activeTabIndex === 'number' &&
            activeTabIndex >= 0 &&
            activeTabIndex < chartConfigurations.length ?
            chartConfigurations[activeTabIndex] : null;

        // Call original generateTableHtml function with configuration
        if (typeof generateTableHtml === 'function') {
            return generateTableHtml(data, currentChartConfig);
        }
        return '';
    };

    // Configuration save function - called by visualize-core.js generateChart button handler
    window.saveConfigurationOnChartGeneration = function() {
        // Save current configuration immediately to ensure tab state is preserved
        saveCurrentConfiguration();

        // Mark as having generated chart after a brief delay to ensure the generation completes
        setTimeout(() => {
            if (activeTabIndex >= 0 && activeTabIndex < chartConfigurations.length) {
                chartConfigurations[activeTabIndex].hasGeneratedChart = true;
                saveCurrentConfiguration();
            }
        }, 100); // Reduced delay from 500ms to 100ms for better responsiveness
    };

    // Export all charts button functionality is handled by visualize-export-report.js
    // No duplicate event binding here to avoid multiple error messages

    // Show success modal with a custom message
    function showSuccessModal(message) {
        if (window.GlobalModalManager) {
            window.GlobalModalManager.alert('成功', message, 'success');
        } else {
            alert(message);
        }
    }

    // Check and generate charts for tabs that have complete settings but no chart
    function checkAndGenerateMissingCharts() {
        let generatedCount = 0;

        // Save current active tab
        const currentActiveTab = activeTabIndex;

        // Check each tab configuration
        for (let i = 0; i < chartConfigurations.length; i++) {
            const config = chartConfigurations[i];

            // Skip if already generated or if datasets are empty
            if (config.hasGeneratedChart || !config.datasets || config.datasets.length === 0) {
                continue;
            }

            // Check if all required fields are present
            const hasAllRequiredFields = config.datasets.every(dataset => {
                return dataset.field && dataset.startDate && dataset.endDate;
            });

            if (hasAllRequiredFields) {
                // Activate this tab
                setActiveTab(i);

                // Generate the chart
                if (typeof window.generateChart === 'function') {
                    window.generateChart();
                    generatedCount++;
                }
            }
        }

        // Restore original active tab
        setActiveTab(currentActiveTab);

        return generatedCount;
    }

    // Make chartConfigurations available globally for debugging and access
    window.chartConfigurations = chartConfigurations;

    // Make setActiveTab available globally for other modules
    window.setActiveTab = setActiveTab;

    // Make cleanupChart available globally for other modules
    window.cleanupChart = cleanupChart;

    // Make title management functions available globally
    window.updateTabDisplayTitle = updateTabDisplayTitle;
    window.generateAutoTitle = generateAutoTitle;
});