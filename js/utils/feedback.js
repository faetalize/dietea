/**
 * UI Feedback Utilities
 * Toast notifications and form validation helpers
 */

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'default'
 */
export function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span>${message}`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Show field-level validation error
 * @param {HTMLElement} inputElement - Input element that has error
 * @param {string} message - Error message to display
 */
export function showFieldError(inputElement, message) {
  const formField = inputElement.closest('.form-field');
  if (!formField) return;
  
  formField.classList.add('error');
  
  // Add or update error message
  let errorMsg = formField.querySelector('.error-message');
  if (!errorMsg) {
    errorMsg = document.createElement('span');
    errorMsg.className = 'error-message';
    formField.appendChild(errorMsg);
  }
  errorMsg.textContent = message;
  
  // Remove error on input
  inputElement.addEventListener('input', () => {
    formField.classList.remove('error');
  }, { once: true });
}

/**
 * Clear all validation errors in container
 * @param {HTMLElement} container - Container element
 */
export function clearValidationErrors(container) {
  if (!container) return;
  container.querySelectorAll('.form-field.error').forEach(field => {
    field.classList.remove('error');
  });
}
