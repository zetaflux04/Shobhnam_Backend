import { S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { env } from '../config/env.js';

const s3Config = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  }
});

export const uploadToS3 = multer({
  storage: multerS3({
    s3: s3Config,
    bucket: env.AWS_S3_BUCKET_NAME,
    acl: 'public-read', // Deprecated in some regions, but keeping for standard simple buckets
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `uploads/${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max file size
  }
});

export const uploadSingle = (fieldName) => uploadToS3.single(fieldName);

export const uploadFields = (fields) => uploadToS3.fields(fields);
