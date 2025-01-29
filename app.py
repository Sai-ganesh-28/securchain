from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import boto3
import os
from dotenv import load_dotenv
from datetime import datetime
import logging
import psycopg2
from psycopg2.extras import DictCursor
from flask_bcrypt import Bcrypt
import re

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Check required environment variables
required_env_vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET']
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}")

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app, resources={r"/api/*": {"origins": "*"}})
bcrypt = Bcrypt(app)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    try:
        return app.send_static_file(path)
    except:
        return app.send_static_file('index.html')

# AWS configuration
try:
    s3 = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION')
    )
    # Test S3 connection
    s3.list_buckets()
    logger.info("Successfully connected to AWS S3")
except Exception as e:
    logger.error(f"Failed to connect to AWS S3: {str(e)}")
    raise

BUCKET_NAME = os.getenv('S3_BUCKET')

# Database configuration
def get_db_connection():
    return psycopg2.connect(
        dbname="postgres",
        user="postgres3",
        password="password",
        host="localhost",
        port="5432"
    )

# Create table if not exists
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Create documents table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            filename VARCHAR(255),
            file_type VARCHAR(50),
            file_size BIGINT,
            s3_path VARCHAR(512),
            upload_date TIMESTAMP,
            last_verified TIMESTAMP,
            is_manipulated BOOLEAN DEFAULT FALSE
        )
    ''')
    
    # Create users table with additional fields
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(100) NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            phone_number VARCHAR(20) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()

# Allowed file extensions
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "Server is running"}), 200

@app.route('/api/documents/add', methods=['POST'])
def add_document():
    try:
        logger.info("Received document upload request")
        logger.debug(f"Form data: {request.form}")
        logger.debug(f"Files: {request.files}")

        if 'docFile' not in request.files:
            return jsonify({'success': False, 'message': 'No file part in the request'}), 400

        file = request.files['docFile']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

        # Get form data
        name = request.form.get('docName')
        doc_type = request.form.get('docType')
        description = request.form.get('docDesc')

        if not all([name, doc_type, description]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        # Get file size
        file.seek(0, 2)  # Seek to end of file
        file_size = file.tell()
        file.seek(0)  # Reset file pointer to beginning

        # Secure the filename and create unique path
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        s3_file_path = f"{name}/{timestamp}_{filename}"

        # Upload to S3
        try:
            s3.upload_fileobj(
                file,
                BUCKET_NAME,
                s3_file_path,
                ExtraArgs={
                    'ContentType': file.content_type,
                    'Metadata': {
                        'name': name,
                        'type': doc_type,
                        'description': description,
                        'upload_date': timestamp,
                        'file_size': str(file_size)
                    }
                }
            )
            logger.info(f"Successfully uploaded file to S3: {s3_file_path}")
        except Exception as e:
            logger.error(f"S3 upload failed: {str(e)}")
            return jsonify({'success': False, 'message': 'Failed to upload file to S3'}), 500

        # Store in PostgreSQL
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO documents (name, filename, file_type, file_size, s3_path, upload_date)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (name, filename, doc_type, file_size, s3_file_path, datetime.now()))
            conn.commit()
            cur.close()
            conn.close()
            logger.info("Successfully stored document metadata in database")
        except Exception as e:
            logger.error(f"Database insert failed: {str(e)}")
            return jsonify({'success': False, 'message': 'Failed to store document metadata'}), 500

        # Get the URL of the uploaded file
        file_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{s3_file_path}"

        return jsonify({
            'success': True,
            'message': 'Document uploaded successfully',
            'data': {
                'name': name,
                'document': filename,
                'type': doc_type,
                'size': file_size,
                'description': description,
                'verification': 'Pending',
                'dateTime': timestamp,
                'isManipulated': 'No',
                'file_url': file_url,
                's3_path': s3_file_path
            }
        })

    except Exception as e:
        logger.error(f"Error in add_document: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

@app.route('/api/documents', methods=['GET'])
def get_documents():
    try:
        logger.info("Fetching documents from S3")
        response = s3.list_objects_v2(Bucket=BUCKET_NAME)
        
        documents = []
        if 'Contents' in response:
            # Sort by last modified date, newest first
            sorted_contents = sorted(response['Contents'], 
                                  key=lambda x: x['LastModified'], 
                                  reverse=True)
            
            # Take only the 5 most recent files
            for obj in sorted_contents[:5]:
                try:
                    obj_response = s3.head_object(Bucket=BUCKET_NAME, Key=obj['Key'])
                    metadata = obj_response.get('Metadata', {})
                    
                    # Format the size to be human-readable
                    size_bytes = obj['Size']
                    if size_bytes < 1024:
                        size_str = f"{size_bytes} B"
                    elif size_bytes < 1024 * 1024:
                        size_str = f"{size_bytes/1024:.1f} KB"
                    else:
                        size_str = f"{size_bytes/(1024*1024):.1f} MB"
                    
                    documents.append({
                        'name': metadata.get('name', ''),
                        'document': obj['Key'].split('/')[-1],
                        'description': metadata.get('description', ''),
                        'verification': 'Pending',
                        'dateTime': metadata.get('upload_date', ''),
                        'isManipulated': 'No',
                        'file_url': f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{obj['Key']}"
                    })
                except Exception as e:
                    logger.error(f"Error processing object {obj['Key']}: {str(e)}")
                    continue

        return jsonify({
            'success': True,
            'documents': documents
        })

    except Exception as e:
        logger.error(f"Error in get_documents: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to fetch documents'}), 500

@app.route('/api/documents/verify', methods=['POST'])
def verify_document():
    try:
        data = request.get_json()
        qr_data = data.get('qr_data')
        
        if not qr_data:
            return jsonify({'success': False, 'message': 'Missing QR data'}), 400

        logger.info(f"Verifying document with QR data: {qr_data}")

        # Get document metadata from database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=DictCursor)
        
        # First try exact match
        cur.execute('SELECT * FROM documents WHERE name = %s', (qr_data.get('name'),))
        db_record = cur.fetchone()

        if not db_record:
            logger.warning(f"Document not found with name: {qr_data.get('name')}")
            return jsonify({'success': False, 'message': 'Document not found in database'}), 404

        # Compare metadata from QR code with database
        is_manipulated = False
        differences = []

        # Compare file type
        if db_record['file_type'].lower() != qr_data.get('type', '').lower():
            is_manipulated = True
            differences.append('file_type')
            logger.warning(f"File type mismatch: DB={db_record['file_type']}, QR={qr_data.get('type')}")

        # Compare file size if available
        if 'size' in qr_data and str(db_record['file_size']) != str(qr_data.get('size')):
            is_manipulated = True
            differences.append('file_size')
            logger.warning(f"File size mismatch: DB={db_record['file_size']}, QR={qr_data.get('size')}")

        # Update verification status in database
        cur.execute('''
            UPDATE documents 
            SET last_verified = %s, is_manipulated = %s 
            WHERE id = %s
        ''', (datetime.now(), is_manipulated, db_record['id']))
        conn.commit()

        # Get the document details for response
        document_details = {
            'id': db_record['id'],
            'name': db_record['name'],
            'type': db_record['file_type'],
            'upload_date': db_record['upload_date'].isoformat() if db_record['upload_date'] else None,
            'last_verified': datetime.now().isoformat(),
            'is_manipulated': is_manipulated,
            's3_path': db_record['s3_path']
        }

        cur.close()
        conn.close()

        logger.info(f"Verification complete. Is manipulated: {is_manipulated}")
        return jsonify({
            'success': True,
            'is_manipulated': is_manipulated,
            'differences': differences,
            'message': 'Document verified successfully' if not is_manipulated else 'Document has been manipulated',
            'document': document_details,
            'verification_time': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Error in verify_document: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

def validate_password(password):
    """
    Validate password strength
    Returns (bool, str) - (is_valid, error_message)
    """
    if len(password) < 9:
        return False, "Password must be at least 9 characters long"
    
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"
    
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)"
    
    return True, ""

# User registration endpoint
@app.route('/api/auth/register', methods=['POST'])
def register_user():
    try:
        data = request.get_json()
        full_name = data.get('fullName')
        username = data.get('username')
        email = data.get('email')
        phone_number = data.get('phoneNumber')
        password = data.get('password')
        captcha = data.get('captcha')
        expected_captcha = data.get('expectedCaptcha')

        # Validate required fields
        if not all([full_name, username, email, phone_number, password, captcha]):
            return jsonify({'success': False, 'message': 'All fields are required'}), 400

        # Validate password strength
        is_valid_password, password_error = validate_password(password)
        if not is_valid_password:
            return jsonify({'success': False, 'message': password_error}), 400

        # Validate captcha
        if captcha != expected_captcha:
            return jsonify({'success': False, 'message': 'Invalid captcha'}), 400

        # Validate email format
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400

        # Validate phone number format (assuming 10 digits)
        if not re.match(r"^\d{10}$", phone_number):
            return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # Check if username already exists
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Username already exists'}), 409

        # Check if email already exists
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Email already exists'}), 409

        # Hash the password before storing
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

        # Insert new user
        cur.execute('''
            INSERT INTO users (full_name, username, email, phone_number, password)
            VALUES (%s, %s, %s, %s, %s)
        ''', (full_name, username, email, phone_number, hashed_password))
        
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': 'User registered successfully'
        })

    except Exception as e:
        logger.error(f"Error in register_user: {str(e)}")
        return jsonify({'success': False, 'message': 'Registration failed'}), 500

# User login endpoint
@app.route('/api/auth/login', methods=['POST'])
def login_user():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required'}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=DictCursor)

        # Get user from database
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found. Please register first.'
            }), 404

        # Check password
        if bcrypt.check_password_hash(user['password'], password):
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'user': {
                    'username': user['username'],
                    'id': user['id']
                }
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Incorrect password'
            }), 401

    except Exception as e:
        logger.error(f"Error in login_user: {str(e)}")
        return jsonify({'success': False, 'message': 'Login failed'}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    init_db()  # Initialize database
    app.run(host='0.0.0.0', debug=True, port=5001)
