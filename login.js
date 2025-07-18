// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Check if already logged in
    checkAuthStatus();

    // Check for remembered credentials
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
        usernameInput.value = rememberedUsername;
        rememberMeCheckbox.checked = true;
    }

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;

        // Clear previous error
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';

        // Disable form during submission
        setFormDisabled(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Save username if remember me is checked
                if (rememberMe) {
                    localStorage.setItem('rememberedUsername', username);
                } else {
                    localStorage.removeItem('rememberedUsername');
                }

                // Store auth token
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }

                // Show success message
                showSuccessMessage();

                // Redirect to admin dashboard after a short delay
                setTimeout(() => {
                    window.location.href = '/admin-dashboard.html';
                }, 1000);
            } else {
                // Show error message
                showError(data.error || 'Invalid username or password');
                setFormDisabled(false);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('An error occurred. Please try again.');
            setFormDisabled(false);
        }
    });

    // Check if user is already authenticated
    async function checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const response = await fetch('/api/auth/verify', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    // Already logged in, redirect to admin
                    window.location.href = '/admin-dashboard.html';
                } else {
                    // Invalid token, remove it
                    localStorage.removeItem('authToken');
                }
            } catch (error) {
                console.error('Auth check error:', error);
            }
        }
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Add shake animation
        errorMessage.style.animation = 'none';
        setTimeout(() => {
            errorMessage.style.animation = 'shake 0.5s ease-in-out';
        }, 10);
    }

    // Show success message
    function showSuccessMessage() {
        const button = loginForm.querySelector('.btn-login');
        const buttonText = button.querySelector('.btn-text');
        const buttonIcon = button.querySelector('.btn-icon');
        
        buttonText.textContent = 'Success!';
        buttonIcon.innerHTML = `
            <polyline points="20 6 9 17 4 12"></polyline>
        `;
        button.style.background = 'linear-gradient(135deg, #10B981, #059669)';
    }

    // Enable/disable form
    function setFormDisabled(disabled) {
        usernameInput.disabled = disabled;
        passwordInput.disabled = disabled;
        rememberMeCheckbox.disabled = disabled;
        loginForm.querySelector('.btn-login').disabled = disabled;
        
        if (disabled) {
            loginForm.querySelector('.btn-login').style.opacity = '0.7';
            loginForm.querySelector('.btn-login').style.cursor = 'not-allowed';
        } else {
            loginForm.querySelector('.btn-login').style.opacity = '1';
            loginForm.querySelector('.btn-login').style.cursor = 'pointer';
        }
    }

    // Add input animations
    const inputs = document.querySelectorAll('.form-control');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.querySelector('.input-icon').style.transform = 'translateY(-50%) scale(1.1)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.querySelector('.input-icon').style.transform = 'translateY(-50%) scale(1)';
        });
    });
});