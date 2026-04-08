/**
 * DOM Utilities Module
 * Provides safe alternatives to innerHTML and other DOM manipulation methods
 */

class DOMUtils {
    /**
     * Safely set text content (prevents XSS)
     * @param {HTMLElement} element 
     * @param {string} text 
     */
    static setText(element, text) {
        if (element) {
            element.textContent = text || '';
        }
    }

    /**
     * Safely create and append HTML elements
     * @param {HTMLElement} parent 
     * @param {string} tagName 
     * @param {Object} attributes 
     * @param {string} textContent 
     * @returns {HTMLElement}
     */
    static createElement(parent, tagName, attributes = {}, textContent = '') {
        const element = document.createElement(tagName);
        
        // Set attributes safely
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'class') {
                element.className = value;
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, value);
            } else if (['id', 'type', 'name', 'value', 'href'].includes(key)) {
                element.setAttribute(key, value);
            }
        });

        // Set text content safely
        if (textContent) {
            element.textContent = textContent;
        }

        if (parent) {
            parent.appendChild(element);
        }

        return element;
    }

    /**
     * Safely replace innerHTML with structured content
     * @param {HTMLElement} element 
     * @param {Function} builderFunction 
     */
    static replaceContent(element, builderFunction) {
        if (!element || typeof builderFunction !== 'function') return;
        
        // Clear existing content
        element.innerHTML = '';
        
        // Build new content using safe methods
        builderFunction(element);
    }

    /**
     * Create button with safe event handling
     * @param {string} text 
     * @param {string} className 
     * @param {Function} clickHandler 
     * @returns {HTMLButtonElement}
     */
    static createButton(text, className = '', clickHandler = null) {
        const button = document.createElement('button');
        button.textContent = text;
        button.type = 'button';
        
        if (className) {
            button.className = className;
        }
        
        if (clickHandler && typeof clickHandler === 'function') {
            button.addEventListener('click', clickHandler);
        }
        
        return button;
    }

    /**
     * Create icon element safely
     * @param {string} iconClass 
     * @returns {HTMLSpanElement}
     */
    static createIcon(iconClass) {
        const icon = document.createElement('span');
        icon.className = `ts-icon ${iconClass}`;
        return icon;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str 
     * @returns {string}
     */
    static escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Safe template literal replacement
     * @param {string} template 
     * @param {Object} values 
     * @returns {string}
     */
    static safeTemplate(template, values) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return values[key] ? this.escapeHtml(String(values[key])) : '';
        });
    }

    /**
     * Add multiple event listeners to element
     * @param {HTMLElement} element 
     * @param {Object} events 
     */
    static addEventListeners(element, events) {
        Object.entries(events).forEach(([event, handler]) => {
            if (typeof handler === 'function') {
                element.addEventListener(event, handler);
            }
        });
    }

    /**
     * Show/hide elements with proper accessibility
     * @param {HTMLElement} element 
     * @param {boolean} show 
     */
    static toggleVisibility(element, show) {
        if (!element) return;
        
        if (show) {
            element.style.display = '';
            element.removeAttribute('aria-hidden');
        } else {
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Safely clear element contents
     * @param {HTMLElement} element 
     */
    static clearElement(element) {
        if (element) {
            element.innerHTML = '';
        }
    }

    /**
     * Create complex grid layout for transportation data display
     * @param {HTMLElement} parent 
     * @param {Array} columns 
     */
    static createGridLayout(parent, columns = []) {
        const grid = this.createElement(parent, 'div', { class: 'ts-grid is-3-columns has-spaced' });
        
        columns.forEach(col => {
            const column = this.createElement(grid, 'div', { 
                class: `column ts-box is-raised background-quaternary ${col.class || ''}` 
            });
            const content = this.createElement(column, 'div', { class: 'ts-content' });
            
            if (col.header) {
                this.createElement(content, 'div', { class: 'ts-header has-bottom-spaced-small' }, col.header);
            }
            if (col.text) {
                this.createElement(content, 'div', { 
                    class: 'ts-text is-massive is-center-aligned monospace-medium' 
                }, col.text);
            }
        });
        
        return grid;
    }

    /**
     * Create detailed information grid
     * @param {HTMLElement} parent 
     * @param {Array} rows 
     */
    static createDetailGrid(parent, rows = []) {
        rows.forEach(row => {
            const gridClass = row.gridClass || 'ts-grid is-1-columns has-spaced';
            const gridContainer = this.createElement(parent, 'div', { class: gridClass });
            
            if (row.isMultiColumn) {
                // Handle multi-column layout
                row.columns.forEach(col => {
                    const column = this.createElement(gridContainer, 'div', { 
                        class: `column ${col.class || ''} ts-box is-raised background-quaternary` 
                    });
                    const content = this.createElement(column, 'div', { class: 'ts-content' });
                    
                    if (col.header) {
                        this.createElement(content, 'div', { class: 'ts-header has-bottom-spaced-small' }, col.header);
                    }
                    if (col.text) {
                        this.createElement(content, 'div', { 
                            class: 'ts-text is-massive is-center-aligned monospace-medium' 
                        }, col.text);
                    }
                });
            } else {
                // Handle single column with internal grid
                const column = this.createElement(gridContainer, 'div', { class: 'column ts-box is-raised background-quaternary' });
                const content = this.createElement(column, 'div', { class: 'ts-content' });
                
                if (row.items && Array.isArray(row.items)) {
                    row.items.forEach(item => {
                        const itemGrid = this.createElement(content, 'div', { 
                            class: item.gridClass || 'ts-grid' 
                        });
                        
                        if (item.label) {
                            this.createElement(itemGrid, 'div', { 
                                class: item.labelClass || 'column is-2-wide ts-header has-bottom-spaced-small' 
                            }, item.label);
                        }
                        
                        if (item.value !== undefined) {
                            this.createElement(itemGrid, 'div', { 
                                class: item.valueClass || 'column is-fluid ts-text is-massive monospace-medium' 
                            }, item.value || '');
                        }
                        
                        // Handle additional columns (like units)
                        if (item.extraColumns) {
                            item.extraColumns.forEach(extra => {
                                const extraDiv = this.createElement(itemGrid, 'div', { 
                                    class: extra.class || 'column is-fluid' 
                                });
                                this.createElement(extraDiv, 'div', {
                                    class: 'ts-text is-large monospace-medium'
                                }, extra.content || '');
                            });
                        }
                    });
                }
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
} else {
    window.DOMUtils = DOMUtils;
}