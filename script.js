// Global variables
const API_BASE_URL = 'http://localhost:5001/api';
let currentQR = null;

// Show/hide modals
function showAddDocumentModal() {
    document.getElementById('addDocumentModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('addDocumentModal').style.display = 'none';
    document.getElementById('docForm').reset();
}

function closeQRModal() {
    const modal = document.getElementById('qrCodeModal');
    modal.style.display = 'none';
}

// Table visibility toggle
function toggleTableVisibility() {
    const table = document.getElementById('documentsTable');
    if (table.style.display === 'none' || table.style.display === '') {
        table.style.display = 'block';
        loadDocuments();
    } else {
        table.style.display = 'none';
    }
}

// Document upload
async function addOrUpdateDocument() {
    const form = document.getElementById('docForm');
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="button"]');
    const originalButtonText = submitButton.textContent;

    // Validate form
    const requiredFields = ['docName', 'docType', 'docFile', 'docDesc'];
    for (const field of requiredFields) {
        if (!formData.get(field)) {
            alert(`Please fill in the ${field.replace('doc', '')} field`);
            return;
        }
    }

    // File type validation
    const file = formData.get('docFile');
    const allowedTypes = ['text/plain', 'application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a txt, pdf, png, jpg, doc, or docx file.');
        return;
    }

    try {
        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';

        // First check if server is healthy
        const healthCheck = await fetch(`${API_BASE_URL}/health`);
        if (!healthCheck.ok) {
            throw new Error('Server is not responding');
        }

        // Upload document
        const response = await fetch(`${API_BASE_URL}/documents/add`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            // Create document data for QR code
            const documentData = {
                name: formData.get('docName'),
                document: file.name,
                type: formData.get('docType'),
                description: formData.get('docDesc'),
                dateTime: new Date().toISOString(),
                verification: 'Pending',
                isManipulated: 'No',
                document_hash: data.data.document_hash,
                file_url: data.data.file_url,
                s3_path: data.data.s3_path
            };

            // Generate and show QR code
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = ''; // Clear previous QR code
            
            new QRCode(qrContainer, {
                text: JSON.stringify({
                    name: documentData.name,
                    document: documentData.document,
                    type: documentData.type,
                    description: documentData.description,
                    dateTime: documentData.dateTime,
                    document_hash: documentData.document_hash
                }),
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            // Show QR code modal
            document.getElementById('qrCodeModal').style.display = 'block';
            
            // Show success message
            alert('Document uploaded successfully! You can now download the QR code.');
            closeModal();
            form.reset();
            loadDocuments();
        } else {
            throw new Error(data.message || 'Failed to upload document');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert(`Error: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

// Load documents
async function loadDocuments() {
    const tbody = document.querySelector('#documentsTable tbody');
    try {
        const response = await fetch('http://localhost:5001/api/documents');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        if (data.success) {
            tbody.innerHTML = '';
            if (data.documents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10">No documents found</td></tr>';
                return;
            }

            data.documents.forEach(doc => {
                const row = document.createElement('tr');
                row.setAttribute('data-document', doc.document);
                row.setAttribute('data-s3-path', doc.s3_path);
                
                row.innerHTML = `
                    <td>${escapeHtml(doc.name || '')}</td>
                    <td>${escapeHtml(doc.document || '')}</td>
                    <td>${escapeHtml(doc.type || '')}</td>
                    <td>${escapeHtml(doc.size || '')}</td>
                    <td>${escapeHtml(doc.description || '')}</td>
                    <td>${escapeHtml(doc.verification || 'Pending')}</td>
                    <td>${escapeHtml(doc.dateTime || '')}</td>
                    <td>${escapeHtml(doc.lastModified || '')}</td>
                    <td class="status-cell">${escapeHtml(doc.isManipulated || 'No')}</td>
                    <td>
                        <button onclick="showQRCode(${JSON.stringify(doc)})" class="btn-primary">QR Code</button>
                        ${doc.file_url ? `<a href="${escapeHtml(doc.file_url)}" target="_blank" class="btn-link">Download</a>` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            throw new Error(data.message || 'Failed to load documents');
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        tbody.innerHTML = `<tr><td colspan="10">Error loading documents: ${error.message}</td></tr>`;
    }
}

// QR Code functions
function showQRCode(documentData) {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';

    // Create QR code data
    const qrData = JSON.stringify({
        name: documentData.name,
        document: documentData.document,
        type: documentData.type,
        description: documentData.description,
        dateTime: documentData.dateTime,
        document_hash: documentData.document_hash
    });

    // Generate QR code
    const qr = new QRCode(qrContainer, {
        text: qrData,
        width: 300,
        height: 300,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Add verify button
    const verifyButton = document.createElement('button');
    verifyButton.textContent = 'Verify Document';
    verifyButton.className = 'btn-primary';
    verifyButton.style.marginTop = '10px';
    verifyButton.onclick = () => verifyDocument(JSON.parse(qrData));
    qrContainer.appendChild(verifyButton);

    // Show modal
    document.getElementById('qrCodeModal').style.display = 'block';
}

async function verifyDocument(qrData) {
    try {
        const response = await fetch('http://localhost:5001/api/documents/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ qr_data: qrData })
        });

        const data = await response.json();
        
        if (data.success) {
            const row = document.querySelector(`tr[data-document="${qrData.document}"]`);
            if (row) {
                const verificationCell = row.querySelector('td:nth-child(6)'); // Verification status column
                const statusCell = row.querySelector('td:nth-child(9)'); // Status column
                
                if (verificationCell) {
                    verificationCell.textContent = 'Verified';
                }
                
                if (statusCell) {
                    statusCell.textContent = data.is_manipulated ? 'Manipulated' : 'Not Manipulated';
                    statusCell.style.color = data.is_manipulated ? '#e74c3c' : '#2ecc71';
                    statusCell.style.fontWeight = 'bold';
                }
            }
            
            // Show verification result
            alert(data.message);
        } else {
            alert('Verification failed: ' + data.message);
        }
    } catch (error) {
        console.error('Error verifying document:', error);
        alert('Error verifying document. Please try again.');
    }
}

function downloadQR() {
    const qrImage = document.querySelector('#qrcode img');
    if (!qrImage) {
        alert('No QR code to download');
        return;
    }

    // Create a temporary canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = qrImage.width;
    canvas.height = qrImage.height;
    
    // Draw QR code with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(qrImage, 0, 0);

    // Create download link
    const link = document.createElement('a');
    link.download = 'document-qr-code.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to set active navigation item
function setActiveNav(element) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to clicked item
    element.classList.add('active');
}

// Utility functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Event Listeners
window.onclick = function(event) {
    const qrModal = document.getElementById('qrCodeModal');
    const addModal = document.getElementById('addDocumentModal');
    if (event.target === qrModal) {
        closeQRModal();
    } else if (event.target === addModal) {
        closeModal();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Initial load of documents if table is visible
    const table = document.getElementById('documentsTable');
    if (table.style.display !== 'none') {
        loadDocuments();
    }
});
