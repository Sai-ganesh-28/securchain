function showAddDocumentModal() {
    document.getElementById('addDocumentModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('addDocumentModal').style.display = 'none';
}

function toggleTableVisibility() {
    var table = document.getElementById('documentsTable');
    if (table.style.display === 'none' || table.style.display === '') {
        table.style.display = 'block';
    } else {
        table.style.display = 'none';
    }
}

function addOrUpdateDocument() {
    const formData = new FormData(document.getElementById('docForm'));
    fetch('/api/documents/add', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        if (data.success) {
            closeModal(); // Close the modal after adding
            window.location.reload(); // Reload to see new changes
        }
    })
    .catch(error => console.error('Error:', error));
}
