// Google Sign-In callback
function handleGoogleResponse(response) {
    // Send the ID token to your server
    fetch('/api/auth/google', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            token: response.credential
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            // Store the JWT token
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect to dashboard
            window.location.href = '/index.html';
        } else {
            alert('Login failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during login');
    });
}

// Regular login form submission
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            // Store the JWT token
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect to dashboard
            window.location.href = '/index.html';
        } else {
            alert('Login failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during login');
    });
});
