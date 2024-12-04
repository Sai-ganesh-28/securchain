document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;
    
    // Here you would add your validation logic or API call
    console.log('Username:', username, 'Password:', password);

    // Simulate successful login and redirection
    if (username === 'user' && password === 'pass') {
        window.location.href = 'index.html'; // Redirect to the document management system page
    } else {
        alert('Invalid credentials, please try again!');
    }
});
