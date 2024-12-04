document.getElementById('registrationForm').addEventListener('submit', function(event) {
    event.preventDefault();
    alert('Registered successfully!');
    // Here you can add logic to send data to server
    window.location.href = 'login.html'; 
});
