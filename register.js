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
            window.location.href = '/login.html';
        } else {
            alert('Registration failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during registration');
    });
}

// Regular registration form submission
document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Basic password validation
    if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    fetch('/api/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
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
            window.location.href = '/login.html';
        } else {
            alert('Registration failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during registration');
    });
});
