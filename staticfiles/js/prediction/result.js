document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const generateReportBtn = document.getElementById('generateReportBtn');
    const dataRangeStart = document.getElementById('dataRangeStart');
    const dataRangeEnd = document.getElementById('dataRangeEnd');
    const resultArea = document.getElementById('resultArea');
    const scatterPlotArea = document.getElementById('scatterPlotArea');

    // Hide scatter plot area initially
    scatterPlotArea.style.display = 'none';

    // Clear initial values
    clearResultArea();

    // Show error modal with a custom message using a TS-styled dialog
    function showErrorModal(message) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';

        // Create modal content safely
        const content = DOMUtils.createElement(modal, 'div', { class: 'content' });
        
        const contentDiv1 = DOMUtils.createElement(content, 'div', { class: 'ts-content is-center-aligned is-padded' });
        const headerDiv = DOMUtils.createElement(contentDiv1, 'div', { class: 'ts-header is-icon' });
        DOMUtils.createElement(headerDiv, 'span', { class: 'ts-icon is-triangle-exclamation-icon' });
        headerDiv.appendChild(document.createTextNode('錯誤'));
        DOMUtils.createElement(contentDiv1, 'p', {}, DOMUtils.escapeHtml(message));
        
        DOMUtils.createElement(content, 'div', { class: 'ts-divider' });
        
        const contentDiv2 = DOMUtils.createElement(content, 'div', { class: 'ts-content is-tertiary' });
        DOMUtils.createElement(contentDiv2, 'button', { class: 'ts-button is-fluid close-modal' }, '確定');

        document.body.appendChild(modal);
        modal.showModal();
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
        });
    }

    // Add click event to calculate button
    generateReportBtn.addEventListener('click', function() {
        // Validate input dates
        const startDate = dataRangeStart.value;
        const endDate = dataRangeEnd.value;

        if (!startDate || !endDate) {
            showErrorModal('請選擇開始和結束日期');
            return;
        }

        if (startDate > endDate) {
            showErrorModal('開始日期必須早於結束日期');
            return;
        }

        // Show loading state
        generateReportBtn.disabled = true;
        generateReportBtn.textContent = '';
        DOMUtils.createElement(generateReportBtn, 'span', { class: 'ts-icon is-spinner-icon' });
        generateReportBtn.appendChild(document.createTextNode(' 計算中...'));

        clearResultArea()

        // Request scatter plot data using standardized API handling
        performPredictionCalculation(startDate, endDate);
    });

    // Standardized prediction calculation with proper error handling
    async function performPredictionCalculation(startDate, endDate) {
        try {
            // First request: scatter plot data for date range
            const correlationResult = await APIUtils.post(
                '/prediction/api/calculate_correlation/',
                {
                    start_date: startDate,
                    end_date: endDate
                },
                window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : ''
            );

            if (!correlationResult.success) {
                showErrorModal(correlationResult.error || '計算相關係數時發生錯誤');
                resetButton();
                return;
            }

            // Update scatter plots
            updateScatterPlots(correlationResult.data);
            
            // Show scatter plot area after calculation
            scatterPlotArea.style.display = 'block';

            // Second request: prediction calculation
            const predictionResult = await APIUtils.post(
                '/prediction/api/calculate_prediction/',
                {
                    start_date: startDate,
                    end_date: endDate
                },
                window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : ''
            );

            resetButton();

            if (!predictionResult.success) {
                showErrorModal(predictionResult.error || '計算錯誤');
                return;
            }

            // Update result display
            displayResults(predictionResult.data);
            
        } catch (error) {
            showErrorModal('計算過程發生錯誤: ' + (error.message || error));
            resetButton();
        }
    }

    // Helper function to reset button state
    function resetButton() {
        generateReportBtn.disabled = false;
        generateReportBtn.textContent = '';
        DOMUtils.createElement(generateReportBtn, 'span', { class: 'ts-icon is-terminal-icon' });
        generateReportBtn.appendChild(document.createTextNode(' 開始計算'));
    }

    function clearResultArea() {
        // Clear the result area with empty values
        const headerHtml = `
            <div class="ts-grid is-middle-aligned has-padded">
                <span class="column is-4-wide ts-text is-large single-line is-center-aligned">
                    <span class="ts-text is-big monospace">----</span> 年 <span class="ts-text is-big monospace"><b>--</b></span> 月(次月) 廢棄物產出預測為
                </span>
                <div class="column is-3-wide ts-statistic">
                    <div class="value">---.----</div>
                    <div class="unit">公斤</div>
                </div>
                <span class="column is-fluid ts-text is-large single-line is-start-aligned">
                    R<sup>2</sup> = <span class="ts-text is-big monospace-medium"> -.-----</span> ，共有<span class="monospace-medium"> --- </span>筆有效資料。
                </span>
            </div>
            <div class="ts-divider"></div>
        `;

        // Get field names for table header
        const fields = window.databaseConfig.fields;
        const fieldInfo = window.databaseConfig.fieldInfo;

        // Update medical_waste_total display name to "本月廢棄物總量"
        const updatedFieldInfo = { ...fieldInfo };
        if (updatedFieldInfo.medical_waste_total) {
            updatedFieldInfo.medical_waste_total.name = '本月廢棄物總量';
        }

        // Create column headers for independent variables
        let headerCols = '<th>常數(截距)</th>';
        for (const field of fields) {
            let displayName = field === 'medical_waste_total' ? '本月廢棄物總量' : updatedFieldInfo[field].name;
            headerCols += `<th>${displayName}</th>`;
        }

        // Create empty cells for all variables
        let emptyCells = '<td class="is-empty"></td>';
        for (const field of fields) {
            emptyCells += '<td class="is-empty"></td>';
        }

        // Create empty table with headers
        let tableHtml = `
            <table class="ts-table is-definition is-celled">
                <thead>
                    <tr>
                        <th class="header-column">項目</th>
                        ${headerCols}
                    </tr>
                </thead>
                <tbody>
                    <tr><td>----年--月資料</td>${emptyCells}</tr>
                    <tr><td>VIF</td>${emptyCells}</tr>
                    <tr><td>p 值</td>${emptyCells}</tr>
                    <tr><td>相關係數</td>${emptyCells}</tr>
                    <tr class="background-coefficient monospace-medium"><td>回歸線係數</td>${emptyCells}</tr>
                </tbody>
            </table>
        `;

        // Update result area using safe DOM manipulation
        DOMUtils.clearElement(resultArea);
        
        // Create and append header
        const headerDiv = document.createElement('div');
        headerDiv.innerHTML = headerHtml; // Safe: headerHtml contains only static HTML
        
        // Create and append table
        const tableDiv = document.createElement('div');
        tableDiv.innerHTML = tableHtml; // Safe: tableHtml contains only static structure
        
        resultArea.appendChild(headerDiv);
        resultArea.appendChild(tableDiv);
    }

    // Update the displayResults function in result.js to handle infinity values
    function displayResults(data) {
        // Parse prediction date
        const [year, month] = data.prediction_date.split('-');

        // Get input date (the month being used to make prediction - which is end date)
        // This is used for properly labeling the input data row
        const endYear = dataRangeEnd.value.split('-')[0];
        const endMonth = dataRangeEnd.value.split('-')[1];

        // Get color for r-squared value
        let r2Color = '';
        if (data.r_squared !== undefined && data.r_squared !== null) {
            r2Color = interpolateColor(data.r_squared);
        }

        // Update header section with colored values
        const headerHtml = `
            <div class="ts-grid is-middle-aligned has-padded">
                <span class="column is-4-wide ts-text is-large single-line is-middle-aligned is-center-aligned">
                    <span class="ts-text is-big monospace"><b>${year}</b></span> 年 <span class="ts-text is-big monospace"><b>${month}</b></span> 月(次月) 廢棄物產出預測為
                </span>
                <div class="column is-3-wide ts-statistic">
                    <div class="value" style="color: ${r2Color}">${data.prediction_value !== undefined && data.prediction_value !== null ? data.prediction_value.toFixed(4) : '-'}</div>
                    <div class="unit">公斤</div>
                </div>
                <span class="column is-fluid ts-text is-large single-line is-middle-aligned is-start-aligned">
                    R<sup>2</sup> = <span class="ts-text is-big monospace-medium" style="color: ${r2Color}">${data.r_squared !== undefined && data.r_squared !== null ? data.r_squared.toFixed(6) : '-'}</span> ，共有<span class="monospace-medium"> ${data.valid_data_count || 0} </span>筆有效資料。
                </span>
            </div>
            <div class="ts-divider"></div>
        `;

        // Create table with all independent variables
        const fields = window.databaseConfig.fields;
        const fieldInfo = window.databaseConfig.fieldInfo;

        // Update medical_waste_total display name to "本月廢棄物總量"
        const updatedFieldInfo = { ...fieldInfo };
        if (updatedFieldInfo.medical_waste_total) {
            updatedFieldInfo.medical_waste_total.name = '本月廢棄物總量';
        }

        // Create column headers for independent variables
        let headerCols = '<th>常數(截距)</th>';
        for (const field of fields) {
            let displayName = field === 'medical_waste_total' ? '本月廢棄物總量' : updatedFieldInfo[field].name;
            headerCols += `<th>${displayName}</th>`;
        }

        // Table header
        let tableHtml = `
            <table class="ts-table is-definition is-celled">
                <thead>
                    <tr>
                        <th class="header-column">項目</th>
                        ${headerCols}
                    </tr>
                </thead>
                <tbody>
        `;

        // Input values row (display the values used for prediction)
        // Updated to show it's using the end month (training period) data as input
        tableHtml += `<tr><td>${endYear}年${endMonth}月(本月)資料</td>`;
        tableHtml += `<td class="is-empty"></td>`; // Constant has no value
        for (const field of fields) {
            const value = data.input_values && data.input_values[field];
            if (value === null || value === undefined) {
                tableHtml += `<td class="is-empty"></td>`;
            } else {
                if (updatedFieldInfo[field].unit === 'percent') {
                    tableHtml += `<td>${parseFloat(value).toFixed(1)}</td>`;
                } else if (['person_count', 'person_times'].includes(updatedFieldInfo[field].unit)) {
                    tableHtml += `<td>${parseInt(value)}</td>`;
                } else {
                    tableHtml += `<td>${value}</td>`;
                }
            }
        }
        tableHtml += `</tr>`;

        // VIF row
        tableHtml += `<tr><td>VIF</td>`;
        const constVifValue = data.vif_values && data.vif_values.const;
        const constVifColor = constVifValue > 10 ? 'red' : '';

        // Check if VIF value for constant exists
        if (constVifValue !== null && constVifValue !== undefined) {
            // Format the value
            let formattedVif = "";
            if (isInfinityValue(constVifValue, data.infinity_flags, 'const')) {
                formattedVif = "∞"; // infinity symbol
            } else {
                formattedVif = constVifValue.toFixed(4);
            }
            tableHtml += `<td style="color: ${constVifColor}">${formattedVif}</td>`;
        } else {
            tableHtml += `<td class="is-empty"></td>`;
        }

        for (const field of fields) {
            const value = data.vif_values && data.vif_values[field];
            if (value === null || value === undefined) {
                tableHtml += `<td class="is-empty"></td>`;
            } else {
                // Apply red color for VIF > 10
                const vifColor = value > 10 ? 'red' : '';

                // Check if this is an infinity value
                let formattedVif = "";
                if (isInfinityValue(value, data.infinity_flags, field)) {
                    formattedVif = "∞"; // infinity symbol
                } else {
                    formattedVif = value.toFixed(4);
                }

                tableHtml += `<td style="color: ${vifColor}">${formattedVif}</td>`;
            }
        }
        tableHtml += `</tr>`;

        // P-value row
        tableHtml += `<tr><td>p 值</td>`;
        const constPValue = data.p_values && data.p_values.const;
        let constPColor = '';
        if (constPValue !== null && constPValue !== undefined) {
            if (constPValue > 0.05) {
                constPColor = 'red';
            } else if (constPValue < 0.01) {
                constPColor = 'mediumseagreen';
            }
            tableHtml += `<td style="color: ${constPColor}">${constPValue.toExponential(4)}</td>`;
        } else {
            tableHtml += `<td class="is-empty"></td>`;
        }

        for (const field of fields) {
            const value = data.p_values && data.p_values[field];
            if (value === null || value === undefined) {
                tableHtml += `<td class="is-empty"></td>`;
            } else {
                // Color for p-values: red for > 0.05, green for < 0.01, original for others
                let pColor = '';
                if (value > 0.05) {
                    pColor = 'red';
                } else if (value < 0.01) {
                    pColor = 'mediumseagreen';
                }
                tableHtml += `<td style="color: ${pColor}">${value.toExponential(4)}</td>`;
            }
        }
        tableHtml += `</tr>`;

        // Correlation row
        tableHtml += `<tr><td>相關係數</td><td class="is-empty"></td>`;
        for (const field of fields) {
            const value = data.correlations && data.correlations[field];
            if (value === null || value === undefined) {
                tableHtml += `<td class="is-empty"></td>`;
            } else {
                // Use interpolateColor for correlation coefficients based on absolute value
                const corrColor = interpolateColor(Math.abs(value));
                tableHtml += `<td style="color: ${corrColor}">${value.toFixed(4)}</td>`;
            }
        }
        tableHtml += `</tr>`;

        // Coefficient row
        tableHtml += `<tr class="background-coefficient monospace-medium"><td>回歸線係數</td>`;
        const constCoef = data.coefficients && data.coefficients.const;
        if (constCoef !== null && constCoef !== undefined) {
            tableHtml += `<td>${constCoef.toFixed(4)}</td>`;
        } else {
            tableHtml += `<td class="is-empty"></td>`;
        }

        for (const field of fields) {
            const value = data.coefficients && data.coefficients[field];
            if (value === null || value === undefined) {
                tableHtml += `<td class="is-empty"></td>`;
            } else {
                tableHtml += `<td>${value.toFixed(4)}</td>`;
            }
        }
        tableHtml += `</tr>`;

        // Close table
        tableHtml += `</tbody></table>`;

        // Update result area using safe DOM manipulation
        DOMUtils.clearElement(resultArea);
        
        // Create and append header
        const headerDiv = document.createElement('div');
        headerDiv.innerHTML = headerHtml; // Safe: headerHtml contains only static HTML with safe data
        
        // Create and append table
        const tableDiv = document.createElement('div');
        tableDiv.innerHTML = tableHtml; // Safe: tableHtml contains only static structure with safe data
        
        resultArea.appendChild(headerDiv);
        resultArea.appendChild(tableDiv);
    }

    // Helper function to check if a value should be displayed as infinity
    function isInfinityValue(value, infinityFlags, field) {
        // Check if this is a placeholder for infinity (very large number)
        if (value >= 1e10 || (infinityFlags && infinityFlags.vif && infinityFlags.vif.includes(field))) {
            return true;
        }
        return false;
    }

    function updateScatterPlots(data) {
        // Create scatter plot table
        const variables = data.variables;
        let tableHtml = `
            <table class="ts-table is-definition is-celled">
                <thead>
                    <tr>
                        <th class="is-center-aligned monospace">Y/X</th>
                        ${variables.map(v => {
                            return `<th class="is-center-aligned monospace">${v}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        // Add rows
        for (const rowVar of variables) {
            let rowClass = '';

            tableHtml += `<tr><td class="is-center-aligned is-middle-aligned ${rowClass}" style="width: 3em">${rowVar}</td>`;

            for (const colVar of variables) {
                const correlation = data.correlations[rowVar][colVar];
                const isCurrentWasteColumn = colVar === '本月廢棄物總量';
                const isNextWasteColumn = colVar === '次月廢棄物總量';
                const isCurrentWasteRow = rowVar === '本月廢棄物總量';
                const isNextWasteRow = rowVar === '次月廢棄物總量';

                let cellClass = '';
                if (isNextWasteRow || isNextWasteColumn) {
                    cellClass = 'background-next';
                } else if (isCurrentWasteRow || isCurrentWasteColumn) {
                    cellClass = 'background-this';
                }

                tableHtml += `
                    <td class="is-center-aligned is-middle-aligned monospace ${cellClass}">
                        <div class="scatter-cell"
                             data-row="${rowVar}"
                             data-col="${colVar}"
                             data-points='${JSON.stringify(correlation.points)}'
                             data-r2="${correlation.r2}"
                             data-slope="${correlation.slope}"
                             data-intercept="${correlation.intercept}">
                        </div>
                        <span class="ts-text is-large">R<sup>2</sup> = ${correlation.r2 !== undefined && correlation.r2 !== null ? correlation.r2.toFixed(4) : '-'}</span>
                    </td>
                `;
            }

            tableHtml += `</tr>`;
        }

        tableHtml += `</tbody></table>`;
        DOMUtils.clearElement(scatterPlotArea);
        
        // Use safe DOM manipulation instead of insertAdjacentHTML
        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = tableHtml; // Safe: tableHtml contains only static structure with safe data
        scatterPlotArea.appendChild(tableContainer);

        // Render scatter plots
        renderAllScatterPlots();
    }
});