document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('data-register');
    const requiredInputs = document.querySelectorAll('.input-required');
    const submitButton = document.getElementById('send');

    // Validate required fields and input security
    function validateRequiredFields() {
        let allValid = true;
        requiredInputs.forEach(inputWrapper => {
            const input = inputWrapper.querySelector('input, select');
            const value = input.value.trim();
            
            // Check if empty
            if (!value) {
                inputWrapper.classList.add('is-negative');
                allValid = false;
                return;
            }
            
            // Basic input security check
            if (input.type === 'text' || input.tagName === 'INPUT') {
                // Check for dangerous characters and script injection
                const dangerousPatterns = [
                    /<script/i,
                    /javascript:/i,
                    /on\w+\s*=/i,
                    /<iframe/i,
                    /<object/i,
                    /<embed/i
                ];
                
                const hasDangerousContent = dangerousPatterns.some(pattern => pattern.test(value));
                if (hasDangerousContent) {
                    inputWrapper.classList.add('is-negative');
                    allValid = false;
                    NotificationUtils.showAlert('錯誤', '輸入包含不安全的內容，請檢查後重新輸入', 'error');
                    return;
                }
                
                // Check length limits
                if (value.length > 255) {
                    inputWrapper.classList.add('is-negative');
                    allValid = false;
                    NotificationUtils.showAlert('錯誤', '輸入內容過長，請縮短後重試', 'error');
                    return;
                }
            }
            
            inputWrapper.classList.remove('is-negative');
        });
        return allValid;
    }

    // Submit form
    submitButton.addEventListener('click', async function (e) {
        e.preventDefault();  // Prevent default form submission

        // Validate required fields
        if (!validateRequiredFields()) {
            NotificationUtils.showAlert('錯誤', '請填寫所有必填項目！', 'error');
            return;
        }

        // Show confirmation dialog
        NotificationUtils.showConfirm(
            '確認提交',
            '您確定要提交此表單嗎？',
            () => {
                // User confirmed, proceed with submission
                submitForm();
            },
            () => {
                // User cancelled, do nothing
                console.log('用戶取消了提交');
            }
        );
    });

    // Separate function to handle form submission
    function submitForm() {
        const formData = new FormData(form);

        // Use fetch to send form data
        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': form.querySelector('input[name="csrfmiddlewaretoken"]').value,
            },
            body: formData,
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    NotificationUtils.showAlert('成功', '註冊成功！', 'success');
                    setTimeout(() => {
                        window.location.href = '/account/manage/';
                    }, 1500);
                } else {
                    const errorMsg = DOMUtils.escapeHtml(data.error || '未知錯誤');
                    NotificationUtils.showAlert('錯誤', `註冊失敗：${errorMsg}`, 'error');
                }
            })
            .catch(error => {
                const errorMsg = DOMUtils.escapeHtml(error.message || '網路錯誤');
                NotificationUtils.showAlert('錯誤', `發生錯誤：${errorMsg}`, 'error');
            });
    }

    // Real-time input field status check
    requiredInputs.forEach(inputWrapper => {
        const input = inputWrapper.querySelector('input, select');
        input.addEventListener('input', function () {
            if (input.value.trim()) {
                inputWrapper.classList.remove('is-negative');
            } else {
                inputWrapper.classList.add('is-negative');
            }
        });
    });
});
