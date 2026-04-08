// Define color swatches globally
const swatches = [
    "#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6",
    "#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0",
    "#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78",
    "#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7",
    "#d7e1ee", "#cbd6e4", "#bfcbdb", "#b3bfd1", "#a4a2a8", "#df8879", "#c86558", "#b04238", "#991f17",
    "#2e2b28", "#3b3734", "#474440", "#54504c", "#6b506b", "#ab3da9", "#de25da", "#eb44e8", "#ff80ff",
    "#1984c5", "#22a7f0", "#63bff0", "#a7d5ed", "#e2e2e2", "#e1a692", "#de6e56", "#e14b31", "#c23728",
    "#54bebe", "#76c8c8", "#98d1d1", "#badbdb", "#dedad2", "#e4bcad", "#df979e", "#d7658b", "#c80064",
];


// Get current switchTheme setting for preview - completely avoid recursion
function getCurrentSwitchTheme() {
    // Direct radio button detection without any external function calls
    const lightRadio = document.getElementById('light');
    const darkRadio = document.getElementById('dark');

    if (lightRadio && lightRadio.checked) {
        return 'light';
    } else if (darkRadio && darkRadio.checked) {
        return 'dark';
    }

    // Direct system theme detection without calling other functions
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Optimized color management using the new modular system
function getNextColor() {
    // Try to use the new modular color management
    if (window.VisualizeModule && window.VisualizeModule.colors) {
        return window.VisualizeModule.colors.getNextColor();
    }

    // Fallback to the original logic for backward compatibility
    // Check if we have chart configurations and which tab is active
    if (window.chartConfigurations && typeof window.activeTabIndex === 'number') {
        // Create a colorIndex property for this tab if it doesn't exist
        if (typeof window.chartConfigurations[window.activeTabIndex].colorIndex !== 'number') {
            window.chartConfigurations[window.activeTabIndex].colorIndex = 0;
        }

        // Get the color based on this tab's colorIndex
        const tabColorIndex = window.chartConfigurations[window.activeTabIndex].colorIndex;
        const color = tabColorIndex < swatches.length ? swatches[tabColorIndex] : '#' + Math.random().toString(16).substr(2, 6);

        // Increment the tab's colorIndex
        window.chartConfigurations[window.activeTabIndex].colorIndex =
            (tabColorIndex + 1) % swatches.length;

        // Also update global color index to match current tab's index
        window.globalColorIndex = window.chartConfigurations[window.activeTabIndex].colorIndex;

        return color;
    }

    // Fallback to original behavior if no chart configurations
    if (typeof window.globalColorIndex !== 'number') {
        window.globalColorIndex = 0;
    }

    const color = window.globalColorIndex < swatches.length ?
        swatches[window.globalColorIndex] :
        '#' + Math.random().toString(16).substr(2, 6);

    // Reset globalColorIndex if we reach the end of swatches
    window.globalColorIndex = (window.globalColorIndex + 1) % swatches.length;

    return color;
}

// Initialize data selection logic
document.addEventListener('DOMContentLoaded', () => {
    // Ensure common utilities are available
    if (!window.DOMUtils || !window.ModalUtils) {
        console.error('[Visualize Data] Common utilities not loaded');
        return;
    }

    const addDataBtn = document.getElementById('addDataBtn');
    const dataList = document.getElementById('dataList');
    const xAxisSelect = document.getElementById('xAxis');
    const yAxisSelect = document.getElementById('yAxis');
    const fields = window.visualizeConfig ? window.visualizeConfig.fields : {};
    let previousYAxis = yAxisSelect.value;

    // Initialize colorIndex from chart configuration state
    if (window.chartConfigurations && typeof window.activeTabIndex === 'number') {
        const config = window.chartConfigurations[window.activeTabIndex];
        if (config && typeof config.colorIndex === 'number') {
            window.globalColorIndex = config.colorIndex;
        } else {
            window.globalColorIndex = 0;
        }
    } else {
        window.globalColorIndex = 0;
    }

    // Initialize SortableJS with enhanced theme-aware CSS
    new Sortable(dataList, {
        handle: '.ts-icon.is-bars-icon',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen'
    });

    // Dynamic theme detection function for Coloris
    function getColorisTheme() {
        const currentTheme = getCurrentSwitchTheme(); // Use switchTheme for preview consistency
        return currentTheme === 'dark' ? 'dark' : 'light';
    }

    // Initialize Coloris with enhanced theme support
    function initializeColoris() {
        const themeMode = getColorisTheme();

        Coloris({
            el: '.color-picker',
            wrap: true,
            format: 'hex',
            swatches: swatches,
            swatchesOnly: false,
            defaultColor: '#000000',
            alpha: false,
            theme: 'large',
            themeMode: themeMode,
            onChange: (color, input) => {
                input.style.backgroundColor = color;
                input.value = color;
            }
        });

        // Fix swatches layout after initialization with enhanced styling
        setTimeout(() => {
            const picker = document.querySelector('#clr-picker.clr-picker');
            const swatchesContainer = document.querySelector('#clr-picker .clr-swatches');
            if (swatchesContainer && picker) {
                const wrapperDiv = swatchesContainer.querySelector('div');
                if (wrapperDiv) {
                    while (wrapperDiv.firstChild) {
                        swatchesContainer.appendChild(wrapperDiv.firstChild);
                    }
                    wrapperDiv.remove();
                }

                // swatches styling for better theme support
                swatchesContainer.style.display = 'grid';
                swatchesContainer.style.gridTemplateColumns = 'repeat(9, 1fr)';
                swatchesContainer.style.gridTemplateRows = 'repeat(8, 1fr)';
                swatchesContainer.style.width = '275px';
                swatchesContainer.style.height = '290px';
                swatchesContainer.style.maxWidth = 'none';
                swatchesContainer.style.position = 'relative';
                swatchesContainer.style.margin = '0 auto';
                swatchesContainer.style.justifyItems = 'center';

                const buttons = swatchesContainer.querySelectorAll('button');
                buttons.forEach(button => {
                    button.style.width = '24px';
                    button.style.height = '24px';
                    button.style.margin = '0';
                    button.style.padding = '0';
                    button.style.boxSizing = 'border-box';
                    button.style.fontSize = '0';

                    // hover effects for different themes
                    button.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.1)';
                        this.style.transition = 'transform 0.2s ease';
                    });

                    button.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                    });
                });

                // picker styling for theme support
                picker.style.width = '300px';
                picker.style.minHeight = '475px';
                picker.style.maxWidth = 'none';
                picker.style.overflow = 'visible';

                // Apply theme-specific styling to picker
                if (themeMode === 'dark') {
                    picker.style.backgroundColor = '#1f2937';
                    picker.style.color = '#f9fafb';
                    picker.style.border = '1px solid #374151';
                } else {
                    picker.style.backgroundColor = '#ffffff';
                    picker.style.color = '#111827';
                    picker.style.border = '1px solid #d1d5db';
                }
            }
        }, 100);
    }

    // Function to update Coloris theme with enhanced transition effects
    function updateColorisTheme() {
        // Close any open Coloris instances
        Coloris.close();

        // Add smooth transition effect
        const existingPicker = document.querySelector('#clr-picker');
        if (existingPicker) {
            existingPicker.style.transition = 'all 0.3s ease';
        }

        // Re-initialize with new theme after a brief delay
        setTimeout(() => {
            initializeColoris();
        }, 50);
    }

    // Listen for theme changes to update Coloris with enhanced event handling
    if (window.addEventListener) {
        // Listen for custom theme change events
        window.addEventListener('themeChanged', updateColorisTheme);

        // Listen for switchTheme radio button changes
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');

        if (lightRadio) {
            lightRadio.addEventListener('change', function() {
                if (this.checked) {
                    setTimeout(updateColorisTheme, 100);
                }
            });
        }

        if (darkRadio) {
            darkRadio.addEventListener('change', function() {
                if (this.checked) {
                    setTimeout(updateColorisTheme, 100);
                }
            });
        }

        // Also listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', function() {
            // Only update if we're following system theme
            if (!lightRadio?.checked && !darkRadio?.checked) {
                updateColorisTheme();
            }
        });
    }

    // Store a reference to the original Coloris.setInstance function for enhanced behavior
    const originalSetInstance = Coloris.setInstance;

    // Override the setInstance function to ensure color pickers retain their values with theme support
    Coloris.setInstance = function(input) {
        // Call the original function
        originalSetInstance(input);

        // Set the background color based on the input's current value with theme consideration
        if (input && input.value) {
            input.style.backgroundColor = input.value;

            // Add theme-aware border styling
            const currentTheme = getCurrentSwitchTheme();
            if (currentTheme === 'dark') {
                input.style.border = '1px solid #374151';
                input.style.color = '#f9fafb';
            } else {
                input.style.border = '1px solid #d1d5db';
                input.style.color = '#111827';
            }
        }
    };

    // Initialize Coloris with initial theme
    initializeColoris();

    // Add event listeners
    addDataBtn.addEventListener('click', () => addDataRow(fields, getNextColor()));
    xAxisSelect.addEventListener('change', () => updateDataInputs(xAxisSelect.value, yAxisSelect.value, fields));
    yAxisSelect.addEventListener('change', () => {
        const currentYAxis = yAxisSelect.value;
        const isUnitSwitch =
            (['metric_ton', 'kilogram'].includes(previousYAxis) && currentYAxis === 'new_taiwan_dollar') ||
            (previousYAxis === 'new_taiwan_dollar' && ['metric_ton', 'kilogram'].includes(currentYAxis));
        if (isUnitSwitch) {
            document.querySelectorAll('#dataList .data-field').forEach(select => {
                select.value = '';
                $(select).trigger('change');
            });
        }
        updateDataInputs(xAxisSelect.value, yAxisSelect.value, fields);
        previousYAxis = currentYAxis;
    });

    // Make updateColorisTheme globally available for external theme changes
    window.updateColorisTheme = updateColorisTheme;
});

// Add a new data row with enhanced theme support
function addDataRow(fields, defaultColor) {
    const dataList = document.getElementById('dataList');
    const xAxis = document.getElementById('xAxis').value;
    const yAxis = document.getElementById('yAxis').value;
    const row = document.createElement('div');
    row.className = 'ts-box is-fluid is-raised background-quaternary has-padded has-bottom-spaced';
    const uniqueId = `color-picker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Use safe DOM creation - append DocumentFragment directly
    const domContent = getDataRowDOM(xAxis, yAxis, fields, defaultColor, '', '', '', '', uniqueId);
    row.appendChild(domContent);

    dataList.appendChild(row);

    // Initialize Select2 without theme override (let CSS handle theming)
    const fieldSelect = row.querySelector('.data-field');
    $(fieldSelect).select2({
        placeholder: '選擇資料欄位',
        width: '100%'
    });

    // Add event listeners with enhanced functionality
    row.querySelector('.remove-btn').addEventListener('click', () => {
        // Add smooth removal animation
        row.style.transition = 'all 0.3s ease';
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        setTimeout(() => row.remove(), 300);
    });

    row.querySelector('.copy-btn').addEventListener('click', () => copyDataRow(row, fields));
}

// Update existing data rows without rebuilding HTML unless necessary with enhanced theme support
function updateDataInputs(xAxis, yAxis, fields) {
    const rows = document.querySelectorAll('#dataList .ts-box');
    if (rows.length === 0) return;

    rows.forEach(row => {
        const currentField = row.querySelector('.data-field')?.value || '';
        const currentName = row.querySelector('.data-name')?.value || '';
        const colorInput = row.querySelector('.color-picker');
        const currentColor = colorInput?.value || getNextColor();
        let startDate, endDate;

        if (xAxis.startsWith('year')) {
            startDate = row.querySelector('.start-date')?.value || '';
            endDate = row.querySelector('.end-date')?.value || '';
        } else if (xAxis.startsWith('quarter')) {
            const startYear = row.querySelector('.start-date-year')?.value || '';
            const startQuarter = row.querySelector('.start-date-quarter')?.value || '';
            const endYear = row.querySelector('.end-date-year')?.value || '';
            const endQuarter = row.querySelector('.end-date-quarter')?.value || '';
            startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
            endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
        } else {
            startDate = row.querySelector('.start-date')?.value || '';
            endDate = row.querySelector('.end-date')?.value || '';
        }


        const uniqueId = colorInput?.id || `color-picker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // Use safe DOM creation - replace with DocumentFragment
        const domContent = getDataRowDOM(xAxis, yAxis, fields, currentColor, currentField, currentName, startDate, endDate, uniqueId);

        // Clear existing row content and append new content
        row.replaceChildren(domContent);

        row.dataset.xAxis = xAxis;

        // Re-initialize Select2 without theme override (let CSS handle theming)
        const newFieldSelect = row.querySelector('.data-field');
        $(newFieldSelect).select2({
            placeholder: '選擇資料欄位',
            width: '100%'
        });

        if (currentField) {
            newFieldSelect.value = currentField;
            $(newFieldSelect).trigger('change');
        }

        // Re-add event listeners with enhanced functionality
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.style.transition = 'all 0.3s ease';
            row.style.opacity = '0';
            row.style.transform = 'translateX(-20px)';
            setTimeout(() => row.remove(), 300);
        });
        row.querySelector('.copy-btn').addEventListener('click', () => copyDataRow(row, fields));
    });
}

// Copy an existing data row with specific behavior based on xAxis and enhanced animation
function copyDataRow(row, fields) {
    const xAxis = document.getElementById('xAxis').value;
    const yAxis = document.getElementById('yAxis').value;
    const dataList = document.getElementById('dataList');
    const newRow = document.createElement('div');
    newRow.className = 'ts-box is-fluid is-raised background-quaternary has-padded has-bottom-spaced';

    const currentField = row.querySelector('.data-field')?.value || '';
    const currentName = row.querySelector('.data-name')?.value || '';
    const newColor = getNextColor();
    const uniqueId = `color-picker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    let startDate, endDate;

    if (xAxis.startsWith('year')) {
        startDate = row.querySelector('.start-date')?.value || '';
        endDate = row.querySelector('.end-date')?.value || '';
    } else if (xAxis.startsWith('quarter')) {
        const startYear = row.querySelector('.start-date-year')?.value || '';
        const startQuarter = row.querySelector('.start-date-quarter')?.value || '';
        const endYear = row.querySelector('.end-date-year')?.value || '';
        const endQuarter = row.querySelector('.end-date-quarter')?.value || '';
        startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
        endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
    } else {
        startDate = row.querySelector('.start-date')?.value || '';
        endDate = row.querySelector('.end-date')?.value || '';
        if (xAxis === 'only_month') {
            const startParts = startDate.split('-');
            const endParts = endDate.split('-');
            if (startParts.length === 2 && endParts.length === 2) {
                const newStartYear = (parseInt(startParts[0]) + 1).toString();
                const newEndYear = (parseInt(endParts[0]) + 1).toString();
                startDate = `${newStartYear}-${startParts[1]}`;
                endDate = `${newEndYear}-${endParts[1]}`;
            }
        }
    }

    // Use safe DOM creation - append DocumentFragment directly
    const domContent = getDataRowDOM(xAxis, yAxis, fields, newColor, currentField, currentName, startDate, endDate, uniqueId);
    newRow.appendChild(domContent);

    // Add entrance animation
    newRow.style.opacity = '0';
    newRow.style.transform = 'translateX(20px)';
    dataList.appendChild(newRow);

    // Trigger animation
    setTimeout(() => {
        newRow.style.transition = 'all 0.3s ease';
        newRow.style.opacity = '1';
        newRow.style.transform = 'translateX(0)';
    }, 10);

    // Initialize Select2 without theme override (let CSS handle theming)
    const newFieldSelect = newRow.querySelector('.data-field');
    $(newFieldSelect).select2({
        placeholder: '選擇資料欄位',
        width: '100%'
    });

    if (currentField) {
        newFieldSelect.value = currentField;
        $(newFieldSelect).trigger('change');
    }

    // Add event listeners with enhanced functionality
    newRow.querySelector('.remove-btn').addEventListener('click', () => {
        newRow.style.transition = 'all 0.3s ease';
        newRow.style.opacity = '0';
        newRow.style.transform = 'translateX(-20px)';
        setTimeout(() => newRow.remove(), 300);
    });
    newRow.querySelector('.copy-btn').addEventListener('click', () => copyDataRow(newRow, fields));
}

// Generate HTML for a data row with unique ID for color-picker and enhanced styling
// Create data row DOM elements safely (returns DocumentFragment instead of HTML string)
function getDataRowDOM(xAxis, yAxis, fields, defaultColor = '', currentField = '', currentName = '', startDate = '', endDate = '', colorPickerId = '') {
    const fragment = document.createDocumentFragment();

    // First grid: controls
    const grid1 = document.createElement('div');
    grid1.className = 'ts-grid is-middle-aligned';

    // Handle icon
    const handleIcon = document.createElement('span');
    handleIcon.className = 'column ts-icon is-bars-icon is-large chart-tab-handle sortable-handle';
    grid1.appendChild(handleIcon);

    // Date inputs based on axis type
    if (xAxis.startsWith('year')) {
        const startDiv = document.createElement('div');
        startDiv.className = 'column is-4-wide ts-input';
        const startInput = document.createElement('input');
        startInput.type = 'number';
        startInput.className = 'start-date';
        startInput.min = '1970';
        startInput.max = '9999';
        startInput.step = '1';
        startInput.placeholder = '開始年份';
        startInput.value = startDate;
        startDiv.appendChild(startInput);
        grid1.appendChild(startDiv);

        const separator = document.createElement('span');
        separator.className = 'ts-text';
        separator.textContent = '至';
        grid1.appendChild(separator);

        const endDiv = document.createElement('div');
        endDiv.className = 'column is-4-wide ts-input';
        const endInput = document.createElement('input');
        endInput.type = 'number';
        endInput.className = 'end-date';
        endInput.min = '1970';
        endInput.max = '9999';
        endInput.step = '1';
        endInput.placeholder = '結束年份';
        endInput.value = endDate;
        endDiv.appendChild(endInput);
        grid1.appendChild(endDiv);
    } else if (xAxis.startsWith('quarter')) {
        const [startYear, startQuarter] = startDate ? startDate.split('-') : ['', ''];
        const [endYear, endQuarter] = endDate ? endDate.split('-') : ['', ''];

        // Start year input
        const startYearDiv = document.createElement('div');
        startYearDiv.className = 'column is-2-wide ts-input';
        const startYearInput = document.createElement('input');
        startYearInput.type = 'number';
        startYearInput.className = 'start-date-year';
        startYearInput.min = '1970';
        startYearInput.max = '9999';
        startYearInput.step = '1';
        startYearInput.placeholder = '開始年份';
        startYearInput.value = startYear;
        startYearDiv.appendChild(startYearInput);
        grid1.appendChild(startYearDiv);

        // Start quarter select
        const startQuarterDiv = document.createElement('div');
        startQuarterDiv.className = 'column ts-select is-2-wide';
        const startQuarterSelect = document.createElement('select');
        startQuarterSelect.className = 'start-date-quarter';
        for (let i = 1; i <= 4; i++) {
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = `第${['一', '二', '三', '四'][i-1]}季`;
            if (startQuarter === i.toString()) option.selected = true;
            startQuarterSelect.appendChild(option);
        }
        startQuarterDiv.appendChild(startQuarterSelect);
        grid1.appendChild(startQuarterDiv);

        const separator = document.createElement('span');
        separator.className = 'ts-text';
        separator.textContent = '至';
        grid1.appendChild(separator);

        // End year input
        const endYearDiv = document.createElement('div');
        endYearDiv.className = 'column is-2-wide ts-input';
        const endYearInput = document.createElement('input');
        endYearInput.type = 'number';
        endYearInput.className = 'end-date-year';
        endYearInput.min = '1970';
        endYearInput.max = '9999';
        endYearInput.step = '1';
        endYearInput.placeholder = '結束年份';
        endYearInput.value = endYear;
        endYearDiv.appendChild(endYearInput);
        grid1.appendChild(endYearDiv);

        // End quarter select
        const endQuarterDiv = document.createElement('div');
        endQuarterDiv.className = 'column ts-select is-2-wide';
        const endQuarterSelect = document.createElement('select');
        endQuarterSelect.className = 'end-date-quarter';
        for (let i = 1; i <= 4; i++) {
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = `第${['一', '二', '三', '四'][i-1]}季`;
            if (endQuarter === i.toString()) option.selected = true;
            endQuarterSelect.appendChild(option);
        }
        endQuarterDiv.appendChild(endQuarterSelect);
        grid1.appendChild(endQuarterDiv);
    } else {
        // Month inputs
        const startDiv = document.createElement('div');
        startDiv.className = 'column is-4-wide ts-input';
        const startInput = document.createElement('input');
        startInput.type = 'month';
        startInput.className = 'start-date';
        startInput.placeholder = '開始月份';
        startInput.value = startDate;
        startDiv.appendChild(startInput);
        grid1.appendChild(startDiv);

        const separator = document.createElement('span');
        separator.className = 'ts-text';
        separator.textContent = '至';
        grid1.appendChild(separator);

        const endDiv = document.createElement('div');
        endDiv.className = 'column is-4-wide ts-input';
        const endInput = document.createElement('input');
        endInput.type = 'month';
        endInput.className = 'end-date';
        endInput.placeholder = '結束月份';
        endInput.value = endDate;
        endDiv.appendChild(endInput);
        grid1.appendChild(endDiv);
    }

    // Data name input
    const nameDiv = document.createElement('div');
    nameDiv.className = 'column is-fluid ts-input';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'data-name';
    nameInput.value = currentName;
    nameInput.placeholder = '線段名稱';
    nameDiv.appendChild(nameInput);
    grid1.appendChild(nameDiv);

    // Color picker
    const colorDiv = document.createElement('div');
    colorDiv.className = 'column ts-input is-1-wide';
    const colorInput = document.createElement('input');
    colorInput.type = 'text';
    colorInput.id = colorPickerId;
    colorInput.className = 'color-picker';
    colorInput.value = defaultColor;
    colorInput.setAttribute('data-coloris', '');
    colorInput.style.backgroundColor = defaultColor;
    colorDiv.appendChild(colorInput);
    grid1.appendChild(colorDiv);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'column ts-button is-1-wide is-icon is-warning is-outlined is-critical copy-btn';
    copyBtn.title = '複製線段設定';
    const copyIcon = document.createElement('span');
    copyIcon.className = 'ts-icon is-clipboard-list-icon';
    copyBtn.appendChild(copyIcon);
    grid1.appendChild(copyBtn);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'column ts-button is-1-wide is-icon is-negative is-outlined is-critical remove-btn';
    removeBtn.title = '刪除線段';
    const removeIcon = document.createElement('span');
    removeIcon.className = 'ts-icon is-trash-can-icon';
    removeBtn.appendChild(removeIcon);
    grid1.appendChild(removeBtn);

    fragment.appendChild(grid1);

    // Second grid: field select
    const grid2 = document.createElement('div');
    grid2.className = 'ts-grid is-end-aligned has-top-padded-small';

    const selectColumn = document.createElement('div');
    selectColumn.className = 'column';
    selectColumn.style.width = '58.5em';

    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'data-field';

    // Default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '選擇資料欄位';
    fieldSelect.appendChild(defaultOption);

    // Build field options with optgroups
    const unitTranslations = {
        'metric_ton': '公噸',
        'kilogram': '公斤',
        'new_taiwan_dollar': '新台幣',
    };

    const allowedUnits = yAxis === 'cost_percentage_new_taiwan_dollar' || yAxis === 'new_taiwan_dollar'
        ? ['new_taiwan_dollar']
        : ['metric_ton', 'kilogram'];

    for (const [table, fieldInfo] of Object.entries(fields)) {
        const optgroup = document.createElement('optgroup');
        const tableName = window.visualizeConfig?.tableNames?.[table] || table;
        optgroup.label = tableName;

        let hasOptions = false;
        for (const [field, info] of Object.entries(fieldInfo)) {
            if (allowedUnits.includes(info.unit)) {
                const option = document.createElement('option');
                const optionValue = `${table}:${field}`;
                option.value = optionValue;
                option.textContent = `${info.name} (${unitTranslations[info.unit]})`;
                if (currentField === optionValue) option.selected = true;
                optgroup.appendChild(option);
                hasOptions = true;
            }
        }

        if (hasOptions) {
            fieldSelect.appendChild(optgroup);
        }
    }

    selectColumn.appendChild(fieldSelect);
    grid2.appendChild(selectColumn);
    fragment.appendChild(grid2);

    return fragment;
}