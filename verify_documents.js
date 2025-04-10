// Add event listener for file input
document.getElementById('qrInput').addEventListener('change', handleFileSelect);

// Function to handle file selection
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Display preview
        const preview = document.getElementById('preview');
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = await readFileAsDataURL(file);
        preview.appendChild(img);
    } catch (error) {
        console.error('Error handling file:', error);
        alert('Error handling file: ' + error.message);
    }
}

// Function to read file as data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Function to verify QR code
async function verifyQRCode() {
    const fileInput = document.getElementById('qrInput');
    const resultDiv = document.getElementById('verificationResult');
    
    if (!fileInput.files || !fileInput.files[0]) {
        alert('Please select a QR code image to verify');
        return;
    }

    try {
        resultDiv.innerHTML = '<p class="loading">Scanning QR code and verifying document...</p>';
        
        const img = document.querySelector('#preview img');
        if (!img) {
            throw new Error('Preview image not found');
        }

        // Create canvas and get image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });
        
        if (!code) {
            throw new Error('No QR code found in the image. Make sure the image is clear and contains a valid QR code.');
        }

        // Parse QR code data
        console.log('QR Code Data:', code.data);
        let qrData;
        try {
            qrData = JSON.parse(code.data);
        } catch (error) {
            throw new Error('Invalid QR code format. The QR code does not contain valid document data.');
        }
        
        // Send to backend for verification
        const response = await fetch('http://localhost:5001/api/documents/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ qr_data: qrData })
        });

        const result = await response.json();
        console.log('Verification Result:', result);
        
        if (result.success) {
            displayVerificationResults(result, qrData);
        } else {
            resultDiv.innerHTML = `
                <div class="verification-status error">
                    <h3>Verification Failed</h3>
                    <p>${result.message}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error verifying document:', error);
        resultDiv.innerHTML = `
            <div class="verification-status error">
                <h3>Error</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Function to display verification results
function displayVerificationResults(result, qrData) {
    const resultDiv = document.getElementById('verificationResult');
    const status = result.is_manipulated ? 'Manipulated' : 'Verified';
    const statusClass = result.is_manipulated ? 'manipulated' : 'verified';
    const doc = result.document || {};
    
    let html = `
        <div class="verification-status ${statusClass}">
            <h3>Document Status: ${status}</h3>
            <table class="result-table">
                <tr>
                    <th>Document Name</th>
                    <td>${doc.name || qrData.name}</td>
                </tr>
                <tr>
                    <th>Document Type</th>
                    <td>${doc.type || qrData.type}</td>
                </tr>
                <tr>
                    <th>Upload Date</th>
                    <td>${new Date(doc.upload_date || qrData.dateTime).toLocaleString()}</td>
                </tr>
                <tr>
                    <th>Last Verified</th>
                    <td>${new Date(doc.last_verified).toLocaleString()}</td>
                </tr>
    `;

    if (result.is_manipulated) {
        html += `
                <tr>
                    <th>Changes Detected</th>
                    <td class="warning">${result.differences.join(', ')}</td>
                </tr>
            </table>
            <p class="warning">Warning: ${result.message}</p>
        `;
    } else {
        html += `
                <tr>
                    <th>Changes Detected</th>
                    <td>None</td>
                </tr>
            </table>
            <p class="success">${result.message}</p>
        `;
    }

    html += '</div>';
    resultDiv.innerHTML = html;
}
