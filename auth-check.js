// Authentication check for protected pages
(function() {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        // No token, redirect to login
        window.location.href = '/login.html';
        return;
    }
    
    // Verify token with server
    fetch('/api/auth/verify', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            // Invalid token, clear and redirect
            localStorage.removeItem('authToken');
            window.location.href = '/login.html';
        }
    })
    .catch(error => {
        console.error('Auth verification error:', error);
        // On error, redirect to login for safety
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
    });
    
    // Add auth token to all API requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Only add auth header to API requests
        if (url.includes('/api/')) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        return originalFetch(url, options);
    };
})();

// Logout function
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('rememberedUsername');
        window.location.href = '/login.html';
    })
    .catch(error => {
        console.error('Logout error:', error);
        // Even on error, clear local data and redirect
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('rememberedUsername');
        window.location.href = '/login.html';
    });
}