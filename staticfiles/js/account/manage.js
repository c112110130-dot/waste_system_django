// Display current user data by default
// Button event: Display all data for selected user
const accountInfoElement = document.getElementById('account-info');
const currentAccount = accountInfoElement?.getAttribute("current-account");
const permission_types = {
    'root': { name: '根帳號', color: 'color-root' },
    'moderator': { name: '管理者', color: 'color-moderator' },
    'staff': { name: '行政人員', color: 'color-staff' },
    'registrar': { name: '登錄者', color: 'color-registrar' },
    'importer': { name: '匯入者', color: 'color-importer' },
    'not-defined': { name: '未知身份', color: 'color-not-defined' }
};

document.addEventListener("DOMContentLoaded", () => {
    const contentBox = document.querySelector("#account-info");
    const accountItems = document.querySelectorAll(".ts-menu .item");
    const deleteBtn = document.getElementById("delete-account-btn");
    
    // Ensure common utilities are available
    if (!window.DOMUtils || !window.APIUtils || !window.ModalUtils) {
        console.error('[Account Manager] Common utilities not loaded');
        return;
    }

    // Initialize by fetching current user data
    if (currentAccount && contentBox) {
        fetchAccountData(currentAccount, contentBox);

        // Highlight current account button by default
        accountItems.forEach(item => {
            if (item.getAttribute("data-account") === currentAccount) {
                item.classList.add("is-active");
            }
        });
    }

    // Add click events to each account item
    accountItems.forEach(item => {
        item.addEventListener("click", (event) => {
            // Remove highlighting from all buttons
            accountItems.forEach(btn => btn.classList.remove("is-active"));

            // Highlight currently clicked button
            const clickedItem = event.currentTarget;
            clickedItem.classList.add("is-active");

            // Get clicked account data and update main content
            const account = clickedItem.getAttribute("data-account");
            selectedAccount = account; // Update global selected account
            fetchAccountData(account, contentBox);
        });
    });

    // Add delete button event listener
    if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
            if (selectedAccount) {
                confirmDelete(selectedAccount);
            } else {
                NotificationUtils.showAlert('錯誤', '請先選擇一個帳號！', 'error');
            }
        });
    }
});

let selectedAccount = currentAccount // Global variable

function selectAccount(account) {
    selectedAccount = account

    // You can highlight selected account or perform other actions here
}

// Define fetchAccountData method to fetch and update account information

async function fetchAccountData(account, contentBox) {
    const url = `/account/manage/${account}/`;

    try {
        // Use APIUtils for standardized API communication
        const response = await APIUtils.get(url);
        
        if (!response.success || response.error) {
            // Use DOMUtils for safe DOM manipulation
            DOMUtils.clearElement(contentBox);
            const errorDiv = DOMUtils.createElement(contentBox, 'div', {
                class: 'ts-text is-error'
            }, `無法加載使用者資料：${response.error || '未知錯誤'}`);
        } else {
            // Handle standard API format: {success: true, data: {...}}
            const apiData = response.data;
            const data = (apiData && apiData.data) ? apiData.data : apiData;
            // Display account information
            const perm = permission_types[data.group] || permission_types['not-defined'];
            
            // Clear content safely
            DOMUtils.clearElement(contentBox);
            
            // Create table using DOMUtils
            const table = DOMUtils.createElement(contentBox, 'table', { class: 'ts-table' });
            const tbody = DOMUtils.createElement(table, 'tbody');
                
            // Helper function to create table row using DOMUtils
            const createRow = (label, value, valueClass = '') => {
                const row = DOMUtils.createElement(tbody, 'tr');
                
                // Label cell with safe text content
                const labelCell = DOMUtils.createElement(row, 'td');
                const strong = DOMUtils.createElement(labelCell, 'strong', {}, label);
                
                // Value cell with safe text content
                const valueCell = DOMUtils.createElement(row, 'td', {
                    class: valueClass || ''
                }, value || '');
                
                return row;
            };
                
            // Create all rows using safe helper function
            createRow('帳號ID', data.username, `ts-text monospace ${!data.username ? 'is-empty' : ''}`);
            
            const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
            createRow('姓名', fullName, fullName === '' ? 'is-empty' : '');
            
            createRow('身份', perm.name, `ts-text ${perm.color} ${!data.group ? 'is-empty' : ''}`);
            
            const superuserText = data.is_superuser !== undefined ? (data.is_superuser ? '是' : '否') : '';
            createRow('是否為 Superuser', superuserText, data.is_superuser === undefined ? 'is-empty' : '');
            
            const staffText = data.is_staff !== undefined ? (data.is_staff ? '是' : '否') : '';
            createRow('是否為 Staff', staffText, data.is_staff === undefined ? 'is-empty' : '');
            
            createRow('註冊時間', data.date_joined, `${!data.date_joined ? 'is-empty' : ''} monospace`);
            
            createRow('最近登入時間', data.last_login, `${!data.last_login ? 'is-empty' : ''} monospace`);
        }
    } catch (error) {
        console.error('[Account Manager] Fetch error:', error);
        DOMUtils.clearElement(contentBox);
        DOMUtils.createElement(contentBox, 'div', {
            class: 'ts-text is-error'
        }, `發生錯誤：${error.message || '未知錯誤'}`);
    }
}

function confirmDelete(username) {
    if (!username) {
        NotificationUtils.showAlert('錯誤', '請選擇一個帳號進行刪除！', 'error');
        return;
    }

    if (username === currentAccount) {
        NotificationUtils.showAlert('錯誤', '你不能刪除自己的帳號！', 'error');
        return;
    }

    // Use NotificationUtils for confirmation dialog (correct API)
    NotificationUtils.showConfirm(
        '確認刪除',
        `確定要刪除帳戶「${username}」嗎？這個操作無法撤回！`,
        async () => {
            // Confirmed - proceed with deletion
            try {
                const response = await APIUtils.deleteWithCSRF(`/account/api/delete/${username}/`);

                if (response.success) {
                    NotificationUtils.showAlert('成功', '刪除成功！', 'success');
                    // Reload page after successful deletion
                    setTimeout(() => location.reload(), 1000);
                } else {
                    NotificationUtils.showAlert('錯誤', `刪除失敗：${response.error || '未知錯誤'}`, 'error');
                }
            } catch (error) {
                console.error('[Account Manager] Delete error:', error);
                NotificationUtils.showAlert('錯誤', `操作失敗：${error.message || '未知錯誤'}`, 'error');
            }
        },
        () => {
            // Cancelled - do nothing
            console.log('[Account Manager] Deletion cancelled');
        }
    );
}

// CSRF token functionality is now handled by APIUtils
// No need for manual cookie parsing