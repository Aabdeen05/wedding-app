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
    const { s3Key, s3Url, fileType, uploaderName } = req.body;

    if (!s3Key || !s3Url || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = 'INSERT INTO media (s3_key, s3_url, file_type, uploader_name) VALUES ($1, $2, $3, $4) RETURNING id';
    const values = [s3Key, s3Url, fileType, uploaderName || null];

    const result = await db.query(query, values);

    res.status(201).json({ success: true, mediaId: result.rows[0].id });
  } catch (error) {
    console.error('Error saving media metadata:', error);
    res.status(500).json({ error: 'Failed to save media metadata' });
  }
});

// 3. Fetch Gallery Media (Paginated)
app.get('/api/gallery', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const query = 'SELECT id, s3_url as url, file_type as "fileType", uploader_name as "uploaderName", uploaded_at as "uploadedAt" FROM media ORDER BY uploaded_at DESC LIMIT $1 OFFSET $2';
    const values = [limit, offset];

    const countQuery = 'SELECT COUNT(*) FROM media';

    const [mediaResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery)
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      media: mediaResult.rows,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalItems: total
    });
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
