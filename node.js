// Import necessary libraries
const express = require('express');
const Web3 = require('web3');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const multer = require('multer'); // For handling file uploads

// Configure AWS
AWS.config.update({
    accessKeyId: "YOUR_ACCESS_KEY",
    secretAccessKey: "YOUR_SECRET_KEY",
    region: 'YOUR_REGION'
});

const s3 = new AWS.S3();

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize Express and Middleware
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Web3 and contract setup
const contractAddress = '34.156.89.102';
const abi = [ /* ABI from Truffle compilation */ ];
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const contract = new web3.eth.Contract(abi, contractAddress);

// Express routes
app.post('/storeData', upload.single('file'), async (req, res) => {
    try {
        // Store file in S3
        const fileContent = fs.readFileSync(req.file.path);
        const params = {
            Bucket: 'mojot',
            Key: req.file.filename, // Use file name or any unique identifier
            Body: fileContent
        };

        const s3Response = await s3.upload(params).promise();

        // Interact with contract
        const accounts = await web3.eth.getAccounts();
        await contract.methods.setData(req.body.data).send({ from: accounts[0] });

        // Respond to client
        res.send({ message: 'Data stored and file uploaded', s3Response });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing your request');
    }
});

// Start server
const port = 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

