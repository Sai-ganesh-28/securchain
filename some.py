import psycopg2
from psycopg2 import sql

# Database connection parameters
params = {
    "database": "project",
    "user": "postgres",
    "password": "2vaSJBYVFP0C6FPvk31K",
    "host": "vaidhyamegha-products.ccnnacj5swfd.ap-south-1.rds.amazonaws.com",
    "port": "5432"
}

# Connect to the PostgreSQL database
conn = psycopg2.connect(**params)
cur = conn.cursor()

# Create a table 'hash_info' in the default schema (public)
cur.execute("""
CREATE TABLE IF NOT EXISTS public.hash_info (
    DocumentName TEXT PRIMARY KEY,
    S3BucketURL TEXT
)
""")

# Sample data to insert
documents = [
    ("IEEE(2).pdf", "https://s3.amazonaws.com/store_major_ganesh/IEEE(2).pdf"),
]

# Insert data into the table
for doc in documents:
    try:
        cur.execute("""
        INSERT INTO public.hash_info (DocumentName, S3BucketURL) VALUES (%s, %s)
        ON CONFLICT (DocumentName) DO UPDATE SET 
        S3BucketURL = EXCLUDED.S3BucketURL
        """, (doc[0], doc[1]))
    except psycopg2.Error as e:
        print("An error occurred: ", e)
        conn.rollback()  # Rollback in case of error
    else:
        conn.commit()  # Commit if no error

# Close the connection
cur.close()
conn.close()
