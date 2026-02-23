/**
 * Global Modal Management System
 * Provides unified modal interfaces across all modules
 * Ensures consistent UI/UX for notifications, confirmations, and complex dialogs
 */

window.GlobalModalManager = (function() {
    'use strict';

    // Modal types
    const MODAL_TYPES = {
        ALERT: 'alert',
        CONFIRM: 'confirm',
        PROMPT: 'prompt',
        BULK_DELETE: 'bulk_delete',
        LOADING: 'loading',
        CUSTOM: 'custom'
    };

    // Alert types
    const ALERT_TYPES = {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    };

    // Icon mappings
    const ICON_MAP = {
        [ALERT_TYPES.SUCCESS]: 'check-circle-icon',
        [ALERT_TYPES.ERROR]: 'triangle-exclamation-icon',
        [ALERT_TYPES.WARNING]: 'exclamation-triangle-icon',
        [ALERT_TYPES.INFO]: 'info-circle-icon'
    };

    // Color mappings
    const COLOR_MAP = {
        [ALERT_TYPES.SUCCESS]: 'is-positive',
        [ALERT_TYPES.ERROR]: 'is-negative',
        [ALERT_TYPES.WARNING]: 'is-warning',
        [ALERT_TYPES.INFO]: 'is-info'
    };

    class ModalManager {
        constructor() {
            this.activeModals = new Map();
            this.modalCounter = 0;
            this.defaultOptions = {
                backdrop: true,
                keyboard: true,
                focus: true,
                closable: true
            };

            this.init();
        }

        init() {
            // Add CSS styles for modal animations
            this.addModalStyles();
            
            // Handle escape key globally
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeTopModal();
                }
            });
        }

        addModalStyles() {
            // No animations - keep modals simple like existing ones
            return;
        }

        generateId() {
            return `global-modal-${++this.modalCounter}`;
        }

        createModal(type, options = {}) {
            const id = this.generateId();
            const modal = document.createElement('dialog');
            modal.id = id;
            modal.className = `ts-modal global-modal ${options.size ? `is-${options.size}` : ''}`;

            const content = document.createElement('div');
            content.className = 'content global-modal-content';

            modal.appendChild(content);
            document.body.appendChild(modal);

            const modalInfo = {
                id,
                element: modal,
                content,
                type,
                options,
                resolve: null,
                reject: null
            };

            this.activeModals.set(id, modalInfo);
            return modalInfo;
        }

        /**
         * Show alert modal
         * @param {string} title - Modal title
         * @param {string} message - Alert message
         * @param {string} type - Alert type (success, error, warning, info)
         * @param {Object} options - Additional options
         * @returns {Promise}
         */
        alert(title, message, type = ALERT_TYPES.INFO, options = {}) {
            return new Promise((resolve) => {
                const modalInfo = this.createModal(MODAL_TYPES.ALERT, options);
                modalInfo.resolve = resolve;

                // Main content wrapper
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'ts-content is-center-aligned is-padded';
                
                // Header with icon
                const headerTitle = document.createElement('div');
                headerTitle.className = 'ts-header is-icon';
                
                const icon = document.createElement('span');
                icon.className = `ts-icon is-${ICON_MAP[type]}`;
                headerTitle.appendChild(icon);
                headerTitle.appendChild(document.createTextNode(title));
                
                contentWrapper.appendChild(headerTitle);

                // Message content
                const messageEl = document.createElement('p');
                if (window.SecurityUtils) {
                    window.SecurityUtils.setTextContent(messageEl, message);
                } else {
                    messageEl.textContent = message;
                }
                contentWrapper.appendChild(messageEl);

                // Divider
                const divider = document.createElement('div');
                divider.className = 'ts-divider';

                // Footer
                const footer = document.createElement('div');
                footer.className = 'ts-content is-tertiary';
                
                const okBtn = document.createElement('button');
                okBtn.className = `ts-button is-fluid ${COLOR_MAP[type]}`;
                okBtn.textContent = options.okText || '確定';
                
                footer.appendChild(okBtn);

                // Assemble
                modalInfo.content.appendChild(contentWrapper);
                modalInfo.content.appendChild(divider);
                modalInfo.content.appendChild(footer);

                // Event handlers
                okBtn.addEventListener('click', () => {
                    this.closeModal(modalInfo.id);
                    resolve(true);
                });

                this.showModal(modalInfo);
            });
        }

        /**
         * Show confirm modal
         * @param {string} title - Modal title
         * @param {string} message - Confirmation message
         * @param {Object} options - Additional options
         * @returns {Promise<boolean>}
         */
        confirm(title, message, options = {}) {
            return new Promise((resolve) => {
                const modalInfo = this.createModal(MODAL_TYPES.CONFIRM, options);
                modalInfo.resolve = resolve;

                // Main content wrapper
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'ts-content is-center-aligned is-padded';
                
                // Header with icon (using bomb icon as per your specification)
                const headerTitle = document.createElement('div');
                headerTitle.className = 'ts-header is-icon';
                
                const icon = document.createElement('span');
                icon.className = 'ts-icon is-circle-question-icon';
                headerTitle.appendChild(icon);
                headerTitle.appendChild(document.createTextNode(title));
                
                contentWrapper.appendChild(headerTitle);

                // Message content
                const messageEl = document.createElement('p');
                if (window.SecurityUtils) {
                    window.SecurityUtils.setTextContent(messageEl, message);
                } else {
                    messageEl.textContent = message;
                }
                contentWrapper.appendChild(messageEl);

                // Divider
                const divider = document.createElement('div');
                divider.className = 'ts-divider';

                // Footer
                const footer = document.createElement('div');
                footer.className = 'ts-content is-tertiary';
                
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'ts-grid is-evenly-divided';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'column ts-button';
                cancelBtn.textContent = options.cancelText || '取消';
                
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'column ts-button is-negative';
                confirmBtn.textContent = options.confirmText || '確定';
                
                buttonContainer.appendChild(cancelBtn);
                buttonContainer.appendChild(confirmBtn);
                footer.appendChild(buttonContainer);

                // Assemble
                modalInfo.content.appendChild(contentWrapper);
                modalInfo.content.appendChild(divider);
                modalInfo.content.appendChild(footer);

                // Event handlers
                confirmBtn.addEventListener('click', () => {
                    this.closeModal(modalInfo.id);
                    resolve(true);
                });

                cancelBtn.addEventListener('click', () => {
                    this.closeModal(modalInfo.id);
                    resolve(false);
                });

                this.showModal(modalInfo);
            });
        }

        /**
         * Show bulk delete confirmation modal
         * @param {number} count - Number of items to delete
         * @param {Object} options - Additional options
         * @returns {Promise<boolean>}
         */
        bulkDeleteConfirm(count, options = {}) {
            return new Promise((resolve) => {
                const requiredText = options.requiredText || '我很清楚我目前正在做的事情，而我也願意承擔任何後果。';
                const modalInfo = this.createModal(MODAL_TYPES.BULK_DELETE, { size: 'big', ...options });
                modalInfo.resolve = resolve;

                // Main content wrapper
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'ts-content is-center-aligned is-padded';

                // Header with icon
                const headerTitle = document.createElement('div');
                headerTitle.className = 'ts-header is-icon';

                const icon = document.createElement('span');
                icon.className = 'ts-icon is-triangle-exclamation-icon';
                headerTitle.appendChild(icon);
                headerTitle.appendChild(document.createTextNode('最終確認'));

                contentWrapper.appendChild(headerTitle);

                // Message
                const messageEl = document.createElement('p');
                messageEl.textContent = `您正在刪除大量資料（${count} 筆資料），由於安全性問題，請輸入以下粗體文字後按下確認鍵方可刪除：`;
                const br = document.createElement('br');
                messageEl.appendChild(br);
                const strong = document.createElement('strong');
                strong.textContent = requiredText;
                messageEl.appendChild(strong);
                contentWrapper.appendChild(messageEl);

                // Inner content wrapper for input
                const innerContent = document.createElement('div');
                innerContent.className = 'ts-content';

                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'ts-input';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = '請輸入上方粗體文字';
                input.className = 'bulk-delete-input';

                inputWrapper.appendChild(input);
                innerContent.appendChild(inputWrapper);
                contentWrapper.appendChild(innerContent);

                // Divider
                const divider = document.createElement('div');
                divider.className = 'ts-divider';

                // Footer
                const footer = document.createElement('div');
                footer.className = 'ts-content is-tertiary';

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'ts-grid is-2-columns';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'column ts-button';
                cancelBtn.textContent = '取消';

                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'column ts-button is-negative';
                confirmBtn.textContent = '確認';
                confirmBtn.disabled = true;

                buttonContainer.appendChild(cancelBtn);
                buttonContainer.appendChild(confirmBtn);
                footer.appendChild(buttonContainer);

                // Assemble
                modalInfo.content.appendChild(contentWrapper);
                modalInfo.content.appendChild(divider);
                modalInfo.content.appendChild(footer);

                // Event handlers
                input.addEventListener('input', () => {
                    const isCorrect = input.value.trim() === requiredText;
                    confirmBtn.disabled = !isCorrect;
                    confirmBtn.classList.toggle('is-disabled', !isCorrect);
                });

                confirmBtn.addEventListener('click', () => {
                    const isCorrect = input.value.trim() === requiredText;
                    if (isCorrect) {
                        this.closeModal(modalInfo.id);
                        resolve(true);
                    } else {
                        input.style.borderColor = '#e74c3c';
                        input.placeholder = '輸入文字不正確，請重新輸入';
                        input.value = '';
                        input.focus();
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    this.closeModal(modalInfo.id);
                    resolve(false);
                });

                this.showModal(modalInfo);
                
                // Auto focus
                input.focus();
            });
        }

        /**
         * Show prompt modal
         * @param {string} title - Modal title
         * @param {string} message - Prompt message
         * @param {string} defaultValue - Default input value
         * @param {Object} options - Additional options
         * @returns {Promise<string|null>}
         */
        prompt(title, message, defaultValue = '', options = {}) {
            return new Promise((resolve) => {
                const modalInfo = this.createModal(MODAL_TYPES.PROMPT, options);
                modalInfo.resolve = resolve;

                // Header
                const header = document.createElement('div');
                header.className = 'global-modal-header ts-content is-center-aligned';
                
                const headerTitle = document.createElement('div');
                headerTitle.className = 'ts-header is-icon';
                
                const icon = document.createElement('span');
                icon.className = 'ts-icon is-edit-icon';
                headerTitle.appendChild(icon);
                headerTitle.appendChild(document.createTextNode(title));
                
                header.appendChild(headerTitle);

                // Body
                const body = document.createElement('div');
                body.className = 'ts-content is-center-aligned';
                
                const messageEl = document.createElement('p');
                if (window.SecurityUtils) {
                    window.SecurityUtils.setTextContent(messageEl, message);
                } else {
                    messageEl.textContent = message;
                }
                body.appendChild(messageEl);

                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'ts-input global-modal-input';
                
                const input = document.createElement('input');
                input.type = options.inputType || 'text';
                input.value = defaultValue;
                input.placeholder = options.placeholder || '';
                
                inputWrapper.appendChild(input);
                body.appendChild(inputWrapper);

                // Footer
                const footer = document.createElement('div');
                footer.className = 'global-modal-footer ts-content';
                
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'ts-grid is-2-columns';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'ts-button column';
                cancelBtn.textContent = options.cancelText || '取消';
                
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'ts-button is-positive column';
                confirmBtn.textContent = options.confirmText || '確認';
                
                buttonContainer.appendChild(cancelBtn);
                buttonContainer.appendChild(confirmBtn);
                footer.appendChild(buttonContainer);

                // Assemble
                modalInfo.content.appendChild(header);
                modalInfo.content.appendChild(body);
                modalInfo.content.appendChild(footer);

                // Event handlers
                const submitValue = () => {
                    const value = input.value.trim();
                    if (options.required && !value) {
                        input.style.borderColor = '#e74c3c';
                        input.focus();
                        return;
                    }
                    this.closeModal(modalInfo.id);
                    resolve(value || null);
                };

                confirmBtn.addEventListener('click', submitValue);
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submitValue();
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    this.closeModal(modalInfo.id);
                    resolve(null);
                });

                this.showModal(modalInfo);
                
                // Auto focus and select
                input.focus();
                input.select();
            });
        }

        showModal(modalInfo) {
            modalInfo.element.showModal();
            
            // Handle backdrop click
            if (modalInfo.options.backdrop !== false) {
                modalInfo.element.addEventListener('click', (e) => {
                    if (e.target === modalInfo.element) {
                        this.closeModal(modalInfo.id);
                        if (modalInfo.resolve) {
                            modalInfo.resolve(false);
                        }
                    }
                });
            }
        }

        closeModal(id) {
            const modalInfo = this.activeModals.get(id);
            if (!modalInfo) return;

            if (modalInfo.element.parentNode) {
                modalInfo.element.close();
                modalInfo.element.parentNode.removeChild(modalInfo.element);
            }
            this.activeModals.delete(id);
        }

        closeTopModal() {
            if (this.activeModals.size === 0) return;
            
            // Get the last opened modal
            const lastModal = Array.from(this.activeModals.values()).pop();
            if (lastModal && lastModal.options.keyboard !== false) {
                this.closeModal(lastModal.id);
                if (lastModal.resolve) {
                    lastModal.resolve(false);
                }
            }
        }

        closeAll() {
            Array.from(this.activeModals.keys()).forEach(id => {
                this.closeModal(id);
            });
        }

        getActiveModals() {
            return Array.from(this.activeModals.values());
        }
    }

    // Create global instance
    const instance = new ModalManager();

    // Export API
    return {
        TYPES: MODAL_TYPES,
        ALERT_TYPES,

        // Main methods
        alert: (...args) => instance.alert(...args),
        confirm: (...args) => instance.confirm(...args),
        prompt: (...args) => instance.prompt(...args),
        bulkDeleteConfirm: (...args) => instance.bulkDeleteConfirm(...args),
        
        // Control methods
        closeModal: (...args) => instance.closeModal(...args),
        closeAll: (...args) => instance.closeAll(...args),
        
        // Utility methods
        getActiveModals: (...args) => instance.getActiveModals(...args),
        
        // Instance access
        getInstance: () => instance
    };
})();

// Override NotificationUtils to use GlobalModalManager
if (window.NotificationUtils) {
    const originalShowAlert = window.NotificationUtils.showAlert;
    const originalShowConfirm = window.NotificationUtils.showConfirm;

    window.NotificationUtils.showAlert = function(title, message, type = 'info') {
        // Map old types to new types
        const typeMap = {
            'success': window.GlobalModalManager.ALERT_TYPES.SUCCESS,
            'error': window.GlobalModalManager.ALERT_TYPES.ERROR,
            'warning': window.GlobalModalManager.ALERT_TYPES.WARNING,
            'info': window.GlobalModalManager.ALERT_TYPES.INFO
        };
        
        return window.GlobalModalManager.alert(title, message, typeMap[type] || type);
    };

    window.NotificationUtils.showConfirm = function(title, message, onConfirm, onCancel) {
        window.GlobalModalManager.confirm(title, message)
            .then(result => {
                if (result && onConfirm) {
                    onConfirm();
                } else if (!result && onCancel) {
                    onCancel();
                }
            });
    };
}

// Service registration for dependency injection (if available)
if (window.DependencyInjection) {
    window.DependencyInjection.registerInstance('globalModalManager', window.GlobalModalManager);
}

window.GlobalModalManager.$serviceName = 'globalModalManager';
window.GlobalModalManager.$lifecycle = 'singleton';