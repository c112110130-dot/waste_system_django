/**
 * Safe Modal and Notification Utilities
 * Replaces innerHTML-based modal creation with secure DOM manipulation
 */

class ModalUtils {
    /**
     * Create a confirmation modal safely
     * @param {string} title 
     * @param {string} message 
     * @param {Function} onConfirm 
     * @param {Function} onCancel 
     * @returns {HTMLElement}
     */
    static createConfirmationModal(title, message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'ts-modal is-visible';
        
        const backdrop = document.createElement('div');
        backdrop.className = 'backdrop';
        
        const content = document.createElement('div');
        content.className = 'content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'ts-content';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'ts-header is-large';
        DOMUtils.setText(titleElement, title);
        
        const messageElement = document.createElement('div');
        messageElement.className = 'ts-text';
        DOMUtils.setText(messageElement, message);
        
        header.appendChild(titleElement);
        header.appendChild(messageElement);
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'ts-content';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ts-wrap is-end-aligned';
        
        const cancelButton = DOMUtils.createButton('取消', 'ts-button');
        const confirmButton = DOMUtils.createButton('確認', 'ts-button is-negative');
        
        // Event handlers
        cancelButton.addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });
        
        confirmButton.addEventListener('click', () => {
            modal.remove();
            if (onConfirm) onConfirm();
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        actions.appendChild(buttonContainer);
        
        // Assemble modal
        content.appendChild(header);
        content.appendChild(actions);
        modal.appendChild(backdrop);
        modal.appendChild(content);
        
        return modal;
    }
    
    /**
     * Create an input modal safely
     * @param {string} title 
     * @param {string} placeholder 
     * @param {string} currentValue 
     * @param {Function} onConfirm 
     * @param {Function} onCancel 
     * @returns {HTMLElement}
     */
    static createInputModal(title, placeholder, currentValue, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'ts-modal is-visible';
        
        const backdrop = document.createElement('div');
        backdrop.className = 'backdrop';
        
        const content = document.createElement('div');
        content.className = 'content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'ts-content';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'ts-header is-large';
        DOMUtils.setText(titleElement, title);
        
        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'ts-input is-fluid';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder || '';
        input.value = currentValue || '';
        
        inputContainer.appendChild(input);
        header.appendChild(titleElement);
        header.appendChild(inputContainer);
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'ts-content';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ts-wrap is-end-aligned';
        
        const cancelButton = DOMUtils.createButton('取消', 'ts-button');
        const confirmButton = DOMUtils.createButton('確認', 'ts-button is-positive');
        
        // Event handlers
        cancelButton.addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });
        
        confirmButton.addEventListener('click', () => {
            const value = input.value.trim();
            modal.remove();
            if (onConfirm) onConfirm(value);
        });
        
        // Enter key support
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmButton.click();
            }
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        actions.appendChild(buttonContainer);
        
        // Assemble modal
        content.appendChild(header);
        content.appendChild(actions);
        modal.appendChild(backdrop);
        modal.appendChild(content);
        
        // Auto-focus input
        setTimeout(() => input.focus(), 100);
        
        return modal;
    }
    
    /**
     * Show modal safely
     * @param {HTMLElement} modal 
     */
    static showModal(modal) {
        document.body.appendChild(modal);
        
        // Close on backdrop click
        const backdrop = modal.querySelector('.backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                modal.remove();
            });
        }
    }
}

class NotificationUtils {
    /**
     * Create a safe snackbar notification
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - milliseconds
     * @returns {HTMLElement}
     */
    static createSnackbar(message, type = 'info', duration = 3000) {
        const snackbar = document.createElement('div');
        snackbar.className = `ts-snackbar is-visible is-${type}`;
        
        const content = document.createElement('div');
        content.className = 'content';
        
        const icon = document.createElement('span');
        const iconClass = {
            success: 'is-check-icon',
            error: 'is-xmark-icon',
            warning: 'is-triangle-exclamation-icon',
            info: 'is-circle-info-icon'
        };
        icon.className = `ts-icon ${iconClass[type] || iconClass.info}`;
        
        const text = document.createElement('div');
        text.className = 'ts-text';
        DOMUtils.setText(text, message);
        
        content.appendChild(icon);
        content.appendChild(text);
        snackbar.appendChild(content);
        
        // Auto-remove after duration
        setTimeout(() => {
            snackbar.remove();
        }, duration);
        
        return snackbar;
    }
    
    /**
     * Show snackbar notification
     * @param {string} message 
     * @param {string} type 
     * @param {number} duration 
     */
    static showSnackbar(message, type = 'info', duration = 3000) {
        const snackbar = this.createSnackbar(message, type, duration);
        document.body.appendChild(snackbar);
    }

    // Safe confirmation dialog replacement
    static showConfirm(title, message, onConfirm, onCancel = null) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';
        
        const content = document.createElement('div');
        content.className = 'content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'ts-content is-center-aligned is-padded';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'ts-header is-icon';
        
        const icon = document.createElement('span');
        icon.className = 'ts-icon is-circle-question-icon';
        titleElement.appendChild(icon);
        titleElement.appendChild(document.createTextNode(title));
        
        const messageElement = document.createElement('p');
        DOMUtils.setText(messageElement, message);
        
        header.appendChild(titleElement);
        header.appendChild(messageElement);
        
        // Buttons
        const divider = document.createElement('div');
        divider.className = 'ts-divider';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ts-content is-tertiary';
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'ts-grid is-2-columns is-compact';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ts-button is-fluid';
        DOMUtils.setText(cancelBtn, '取消');
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'ts-button is-fluid is-negative';
        DOMUtils.setText(confirmBtn, '確定');
        
        buttonGroup.appendChild(cancelBtn);
        buttonGroup.appendChild(confirmBtn);
        buttonContainer.appendChild(buttonGroup);
        
        content.appendChild(header);
        content.appendChild(divider);
        content.appendChild(buttonContainer);
        modal.appendChild(content);
        
        // Event handlers
        cancelBtn.addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
            if (onCancel) onCancel();
        });
        
        confirmBtn.addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
            if (onConfirm) onConfirm();
        });
        
        document.body.appendChild(modal);
        modal.showModal();
        
        return modal;
    }

    // Safe alert dialog replacement  
    static showAlert(title, message, type = 'info') {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';
        
        const content = document.createElement('div');
        content.className = 'content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'ts-content is-center-aligned is-padded';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'ts-header is-icon';
        
        const icon = document.createElement('span');
        if (type === 'error') {
            icon.className = 'ts-icon is-triangle-exclamation-icon';
        } else if (type === 'success') {
            icon.className = 'ts-icon is-check-circle-icon';
        } else {
            icon.className = 'ts-icon is-circle-info-icon';
        }
        
        titleElement.appendChild(icon);
        titleElement.appendChild(document.createTextNode(title));
        
        const messageElement = document.createElement('p');
        DOMUtils.setText(messageElement, message);
        
        header.appendChild(titleElement);
        header.appendChild(messageElement);
        
        // Button
        const divider = document.createElement('div');
        divider.className = 'ts-divider';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ts-content is-tertiary';
        
        const okBtn = document.createElement('button');
        okBtn.className = 'ts-button is-fluid';
        DOMUtils.setText(okBtn, '確定');
        
        buttonContainer.appendChild(okBtn);
        
        content.appendChild(header);
        content.appendChild(divider);
        content.appendChild(buttonContainer);
        modal.appendChild(content);
        
        // Event handler
        okBtn.addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
        });
        
        document.body.appendChild(modal);
        modal.showModal();
        
        return modal;
    }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalUtils, NotificationUtils };
} else {
    window.ModalUtils = ModalUtils;
    window.NotificationUtils = NotificationUtils;
}