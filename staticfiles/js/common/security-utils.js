/**
 * Security Utilities - XSS prevention and secure DOM manipulation
 * Replaces unsafe innerHTML assignments with secure alternatives
 */

window.SecurityUtils = (function() {
    'use strict';

    /**
     * HTML encode text to prevent XSS attacks
     * @param {string} text - Text to encode
     * @returns {string} HTML-encoded text
     */
    function htmlEncode(text) {
        if (typeof text !== 'string') return text;
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Safely set text content to prevent XSS
     * @param {HTMLElement} element - Target element
     * @param {string} text - Text content to set
     */
    function setTextContent(element, text) {
        if (!element) return;
        element.textContent = String(text || '');
    }

    /**
     * Safely set HTML content with XSS protection
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content to set
     * @param {Object} options - Options for sanitization
     */
    function safeSetHTML(element, html, options = {}) {
        if (!element || !html) return;

        const allowedTags = options.allowedTags || ['b', 'strong', 'i', 'em', 'span', 'div'];
        const allowedAttributes = options.allowedAttributes || ['class', 'data-*'];

        // Simple sanitization - remove script tags and dangerous attributes
        let sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/gi, '')
            .replace(/on\w+='[^']*'/gi, '')
            .replace(/javascript:/gi, '');

        element.innerHTML = sanitized;
    }

    /**
     * Create a safe text node
     * @param {string} text - Text content
     * @returns {Text} Text node
     */
    function createTextNode(text) {
        return document.createTextNode(text || '');
    }

    /**
     * Create element with safe text content
     * @param {string} tagName - HTML tag name
     * @param {string} textContent - Text content
     * @param {Object} attributes - Element attributes
     * @returns {HTMLElement} Created element
     */
    function createElement(tagName, textContent = '', attributes = {}) {
        const element = document.createElement(tagName);
        
        if (textContent) {
            element.textContent = textContent;
        }

        // Safely set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (typeof value === 'string' && key !== 'innerHTML') {
                element.setAttribute(key, value);
            }
        });

        return element;
    }

    /**
     * Safely append text with optional HTML structure
     * @param {HTMLElement} parent - Parent element
     * @param {string} text - Text content
     * @param {string} wrapper - Optional wrapper tag name
     * @param {Object} attributes - Optional attributes for wrapper
     */
    function appendSafeText(parent, text, wrapper = null, attributes = {}) {
        if (!parent) return;

        if (wrapper) {
            const element = createElement(wrapper, text, attributes);
            parent.appendChild(element);
        } else {
            const textNode = createTextNode(text);
            parent.appendChild(textNode);
        }
    }

    /**
     * Clear element content safely
     * @param {HTMLElement} element - Element to clear
     */
    function clearElement(element) {
        if (!element) return;
        
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    /**
     * Replace innerHTML usage with safe alternative
     * @param {HTMLElement} element - Target element
     * @param {string} template - Template string with placeholders
     * @param {Object} data - Data to substitute in template
     */
    function replaceInnerHTML(element, template, data = {}) {
        if (!element || !template) return;

        clearElement(element);

        // Simple template replacement
        let content = template;
        Object.entries(data).forEach(([key, value]) => {
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            content = content.replace(placeholder, htmlEncode(value));
        });

        safeSetHTML(element, content);
    }

    /**
     * Create filter chip element safely
     * @param {string} text - Filter text
     * @param {Function} removeHandler - Remove click handler
     * @returns {HTMLElement} Filter chip element
     */
    function createFilterChip(text, removeHandler) {
        const chip = createElement('div', '', { class: 'filter-chip' });
        
        // Add text safely
        const textSpan = createElement('span', text);
        chip.appendChild(textSpan);
        
        // Add remove button
        const removeBtn = createElement('button', '', {
            class: 'ts-close is-small remove-filter',
            type: 'button'
        });
        
        if (removeHandler) {
            removeBtn.addEventListener('click', removeHandler);
        }
        
        chip.appendChild(removeBtn);
        
        return chip;
    }

    /**
     * Create manifest item element safely
     * @param {Object} manifest - Manifest data
     * @param {Function} selectHandler - Selection handler
     * @returns {HTMLElement} Manifest item element
     */
    function createManifestItem(manifest, selectHandler) {
        const div = createElement('div', '', {
            class: 'manifest-item',
            'data-manifest-key': `${manifest.manifestNumber}-${manifest.wasteSubstanceId}`
        });

        // Create checkbox
        const checkbox = createElement('input', '', {
            type: 'checkbox',
            class: 'manifest-checkbox',
            'data-manifest-number': manifest.manifestNumber,
            'data-waste-substance-id': manifest.wasteSubstanceId
        });

        if (selectHandler) {
            checkbox.addEventListener('change', selectHandler);
        }

        // Create content container
        const content = createElement('div', '', { class: 'manifest-content' });
        
        // Add manifest details safely
        const details = [
            { label: '聯單編號', value: manifest.manifestNumber },
            { label: '廢棄物名稱', value: manifest.wasteSubstanceName },
            { label: '事業機構', value: manifest.enterpriseName },
            { label: '申報重量', value: `${manifest.declaredWeight} 公噸` },
            { label: '車號', value: manifest.vehicleNumber }
        ];

        details.forEach(detail => {
            const detailDiv = createElement('div', '', { class: 'manifest-detail' });
            const label = createElement('span', `${detail.label}: `, { class: 'label' });
            const value = createElement('span', detail.value || 'N/A', { class: 'value' });
            
            detailDiv.appendChild(label);
            detailDiv.appendChild(value);
            content.appendChild(detailDiv);
        });

        div.appendChild(checkbox);
        div.appendChild(content);

        return div;
    }

    /**
     * Safely create table structure
     * @param {Array} headers - Array of header strings
     * @param {Array} rows - Array of row data arrays
     * @param {Object} options - Table options
     * @returns {HTMLTableElement} Table element
     */
    function createTable(headers, rows, options = {}) {
        const table = document.createElement('table');
        if (options.className) {
            table.className = options.className;
        }

        // Create thead
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create tbody
        const tbody = document.createElement('tbody');
        rows.forEach(rowData => {
            const tr = document.createElement('tr');
            rowData.forEach(cellData => {
                const td = document.createElement('td');
                if (typeof cellData === 'string' || typeof cellData === 'number') {
                    td.textContent = cellData;
                } else if (cellData && cellData.text !== undefined) {
                    td.textContent = cellData.text;
                    if (cellData.className) {
                        td.className = cellData.className;
                    }
                    if (cellData.colSpan) {
                        td.colSpan = cellData.colSpan;
                    }
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        return table;
    }

    /**
     * Safely populate table row
     * @param {HTMLTableRowElement} row - Table row element
     * @param {Array} data - Array of cell data
     * @param {Object} options - Row options
     */
    function populateTableRow(row, data, options = {}) {
        if (!row) return;
        clearElement(row);

        data.forEach((cellData, index) => {
            const td = document.createElement('td');

            if (typeof cellData === 'object' && cellData !== null) {
                if (cellData.text !== undefined) {
                    td.textContent = cellData.text;
                }
                if (cellData.className) {
                    td.className = cellData.className;
                }
                if (cellData.colSpan) {
                    td.colSpan = cellData.colSpan;
                }
            } else {
                td.textContent = String(cellData !== null && cellData !== undefined ? cellData : '');
            }

            row.appendChild(td);
        });
    }

    /**
     * Safely clear and populate table body
     * @param {HTMLElement} tbody - Table body element
     * @param {Array} rows - Array of row data arrays
     */
    function populateTableBody(tbody, rows) {
        if (!tbody) return;
        clearElement(tbody);

        rows.forEach(rowData => {
            const tr = document.createElement('tr');
            populateTableRow(tr, rowData);
            tbody.appendChild(tr);
        });
    }

    /**
     * Get CSRF token from cookie
     * @returns {string|null} CSRF token value or null if not found
     */
    function getCSRFToken() {
        const name = 'csrftoken';
        let cookieValue = null;

        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Check if this cookie string begins with the name we want
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    /**
     * Add CSRF token to fetch headers
     * @param {Object} headers - Existing headers object
     * @returns {Object} Headers with CSRF token added
     */
    function addCSRFHeader(headers = {}) {
        const csrfToken = getCSRFToken();
        if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
        }
        return headers;
    }

    /**
     * Make a secure fetch request with CSRF token
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise} Fetch promise
     */
    function secureFetch(url, options = {}) {
        options.headers = options.headers || {};

        // Add CSRF token for non-GET requests
        if (!options.method || options.method.toUpperCase() !== 'GET') {
            options.headers = addCSRFHeader(options.headers);
        }

        // Set credentials to include cookies
        options.credentials = options.credentials || 'same-origin';

        return fetch(url, options);
    }

    // Public API
    return {
        htmlEncode,
        setTextContent,
        safeSetHTML,
        createTextNode,
        createElement,
        appendSafeText,
        clearElement,
        replaceInnerHTML,
        createFilterChip,
        createManifestItem,
        createTable,
        populateTableRow,
        populateTableBody,
        getCSRFToken,
        addCSRFHeader,
        secureFetch
    };
})();