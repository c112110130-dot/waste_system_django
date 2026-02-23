document.addEventListener("DOMContentLoaded", () => {
    // Initialize back button functionality
    initializeBackButton();
    
    // Theme migration is not critical, skip for now
    
    // Display current user data by default
    const accountInfoContent = document.getElementById('account-info-content');
    if (accountInfoContent) {
        const currentAccount = accountInfoContent.getAttribute("current-account");
        if (currentAccount) {
            fetchAccountData(currentAccount, accountInfoContent);
        } else {
            
        }
    } else {
        
    }

    // Initialize theme settings
    initializeThemeSettings();
});

// Initialize back button functionality
function initializeBackButton() {
    const backButton = document.querySelector('[data-action="back"]');
    if (backButton) {
        backButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Check if theme was changed during this session
            const themeChanged = sessionStorage.getItem('themeChangedInSession') === 'true';
            
            if (themeChanged) {
                // Clear the flag
                sessionStorage.removeItem('themeChangedInSession');
                
                // Force page reload to apply theme changes
                if (window.history.length > 1) {
                    // Get the previous page URL from document.referrer or use main page
                    const previousPage = document.referrer || '/main/';
                    window.location.href = previousPage;
                } else {
                    window.location.href = '/main/';
                }
            } else {
                // Normal back navigation
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    // Fallback to main page if no history
                    window.location.href = '/main/';
                }
            }
        });
    }
}

const permission_types = {
    'root': { name: '根帳號', color: 'color-root' },
    'moderator': { name: '管理者', color: 'color-moderator' },
    'staff': { name: '行政人員', color: 'color-staff' },
    'registrar': { name: '登錄者', color: 'color-registrar' },
    'importer': { name: '匯入者', color: 'color-importer' },
    'not-defined': { name: '未知身份', color: 'color-not-defined' }
};

// Create account table safely
function createAccountTable(contentBox, data, perm, fullName, nameClass) {
    // Clear existing content
    contentBox.replaceChildren();
    
    // Create table structure
    const table = document.createElement('table');
    table.className = 'ts-table is-basic has-top-padded-small';
    
    const tbody = document.createElement('tbody');
    
    // Create table row helper function
    const createRow = (label, value, valueClass = '') => {
        const row = document.createElement('tr');
        
        // Label cell
        const labelCell = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = label;
        labelCell.appendChild(strong);
        
        // Value cell
        const valueCell = document.createElement('td');
        if (valueClass) valueCell.className = valueClass;
        
        if (typeof value === 'object' && value.element) {
            // If value is an object with element (for spans with special classes)
            const span = document.createElement('span');
            span.className = value.className || '';
            span.textContent = value.text || '';
            valueCell.appendChild(span);
        } else {
            // Regular text value
            valueCell.textContent = value || '';
        }
        
        row.appendChild(labelCell);
        row.appendChild(valueCell);
        return row;
    };
    
    // Add rows
    tbody.appendChild(createRow('帳號ID', data.username, `ts-text monospace ${!data.username ? 'is-empty' : ''}`));
    tbody.appendChild(createRow('姓名', fullName, nameClass));
    tbody.appendChild(createRow('身份', {
        element: true,
        className: `ts-text ${perm.color} ${!data.group ? 'is-empty' : ''}`,
        text: perm.name
    }));
    tbody.appendChild(createRow('註冊時間', data.date_joined, `${!data.date_joined ? 'is-empty' : ''} monospace`));
    tbody.appendChild(createRow('最近登入時間', data.last_login, `${!data.last_login ? 'is-empty' : ''} monospace`));
    
    table.appendChild(tbody);
    contentBox.appendChild(table);
}

// Function to fetch account data
function fetchAccountData(currentAccount, contentBox) {
    const url = `/account/manage/${currentAccount}/`; // API endpoint for current user data
    

    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
        .then(response => {
            
            return response.json();
        })
        .then(response => {

            if (response.error || !response.success) {
                contentBox.replaceChildren();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'ts-text is-error';
                errorDiv.textContent = `無法加載使用者資料：${response.error || '未知錯誤'}`;
                contentBox.appendChild(errorDiv);
            } else {
                // Extract actual data from response wrapper
                const data = response.data;

                // Display account information
                const perm = permission_types[data.group] || permission_types['not-defined'];

                // Check if name fields are empty
                const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
                const nameClass = fullName === '' ? 'is-empty' : '';

                createAccountTable(contentBox, data, perm, fullName, nameClass);
            }
        })
        .catch(error => {
            contentBox.replaceChildren();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'ts-text is-error';
            errorDiv.textContent = `發生錯誤：${error.message}`;
            contentBox.appendChild(errorDiv);
        });
}

// Initialize theme settings
function initializeThemeSettings() {
    
    const themeSelect = document.querySelector('#theme-setting select');
    
    if (!themeSelect) {
        
        return;
    }

    // Set option values
    const options = themeSelect.options;
    options[0].value = 'system';
    options[1].value = 'light';
    options[2].value = 'dark';

    // Get current theme setting
    getCurrentTheme().then(currentTheme => {
        
        // Set dropdown selected value
        themeSelect.value = currentTheme;

        // Listen for theme changes
        themeSelect.addEventListener('change', function(e) {
            const selectedTheme = e.target.value;
            changeTheme(selectedTheme);
        });
    }).catch(error => {
        
        // Default to system theme
        themeSelect.value = 'system';
    });
}

// Get current theme setting
function getCurrentTheme() {
    // Check if user is authenticated
    const isAuthenticated = document.body.getAttribute('data-user-authenticated') !== 'false';
    

    if (isAuthenticated) {
        
        // Authenticated users get from server
        return fetch('/account/api/get_theme/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => data.theme);
    } else {
        
        // Use regular localStorage for theme (not sensitive data)
        return Promise.resolve(localStorage.getItem('theme') || 'system');
    }
}

// Change theme
function changeTheme(theme) {
    const isAuthenticated = document.body.getAttribute('data-user-authenticated') !== 'false';

    // Mark that theme was changed in this session
    sessionStorage.setItem('themeChangedInSession', 'true');

    if (isAuthenticated) {
        // Authenticated users save to server
        fetch('/account/api/set_theme/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ theme: theme })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Apply theme immediately
                if (window.themeManager) {
                    window.themeManager.applyTheme(theme);
                }
            } else {
                
                
            }
        })
        .catch(error => {
            
            
        });
    } else {
        // Use regular localStorage for theme (not sensitive data)
        localStorage.setItem('theme', theme);
        
        // Apply theme immediately
        if (window.themeManager) {
            window.themeManager.applyTheme(theme);
        }
        
    }
}

// Function to get CSRF Token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    
    return cookieValue;
}