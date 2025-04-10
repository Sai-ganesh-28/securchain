// Check if token is expired
function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiry = payload.exp * 1000; // Convert to milliseconds
        return Date.now() >= expiry;
    } catch (e) {
        return true;
    }
}

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('token');
    
    // If no token or token is expired, redirect to login
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login.html');
        return false;
    }
    return true;
}

// Handle logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/login.html');
}

// Prevent going back after logout
window.addEventListener('popstate', function(event) {
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
        window.location.replace('/login.html');
    }
});
