require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid'); // Need to install uuid
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database
db.initDb();

// S3 Client Setup
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// 1. Generate Presigned URL Endpoint
app.post('/api/upload-url', async (req, res) => {
  try {
    const { fileType, fileSize } = req.body;

    // Validation: Check file type
    if (!fileType || (!fileType.startsWith('image/') && !fileType.startsWith('video/'))) {
      return res.status(400).json({ error: 'Invalid file type. Only images and videos are allowed.' });
    }

    // Validation: Check file size (e.g. max 500MB for videos, 10MB for images)
    const MAX_SIZE = fileType.startsWith('video/') ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSize > MAX_SIZE) {
      return res.status(400).json({ error: 'File size exceeds limit.' });
    }

    const extension = fileType.split('/')[1];
    const key = `uploads/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    // Create Presigned URL valid for 5 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    res.json({
      uploadUrl,
      key,
      s3Url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// 2. Save Metadata to PostgreSQL after successful upload
app.post('/api/media', async (req, res) => {
  try {
    const { s3Key, s3Url, fileType } = req.body;

    if (!s3Key || !s3Url || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = 'INSERT INTO media (s3_key, s3_url, file_type) VALUES ($1, $2, $3) RETURNING id';
    const values = [s3Key, s3Url, fileType];

    const result = await db.query(query, values);

    res.status(201).json({ success: true, mediaId: result.rows[0].id });
  } catch (error) {
    console.error('Error saving media metadata:', error);
    res.status(500).json({ error: 'Failed to save media metadata' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
