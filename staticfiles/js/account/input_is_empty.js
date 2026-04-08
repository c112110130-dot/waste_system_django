document.getElementById('submit-all').addEventListener('click', function () {
    // Get all parent containers with `input-required` class
    const requiredInputs = document.querySelectorAll('.input-required');

    // Iterate through each input field parent container
    requiredInputs.forEach(function (inputWrapper) {
        // Find input element
        const input = inputWrapper.querySelector('input');

        // Check if input field is empty
        if (input.value === '') {
            // If empty, add `is-negative` class
            inputWrapper.classList.add('is-negative');
        } else {
            // If has value, remove `is-negative` class
            inputWrapper.classList.remove('is-negative');
        }
    });
});

// Real-time detection
document.querySelectorAll('.input-required input').forEach(function (input) {
    input.addEventListener('input', function () {
        const wrapper = input.closest('.input-required');
        if (input.value !== '') {
            wrapper.classList.remove('is-negative');
        }
    });
});
