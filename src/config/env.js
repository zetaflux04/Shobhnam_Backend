import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  MONGODB_URI: z.string().min(1, 'Database URI is required'),
  
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT Access Secret is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT Refresh Secret is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1, 'WhatsApp Phone Number ID is required for OTP'),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, 'WhatsApp Access Token is required for OTP'),
  WHATSAPP_AUTH_TEMPLATE: z.string().default('auth_otp'),

  RAZORPAY_KEY_ID: z.string().min(1, 'Razorpay Key ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'Razorpay Key Secret is required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  
  AWS_REGION: z.string().min(1, 'AWS Region is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS Access Key ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS Secret Access Key is required'),
  AWS_S3_BUCKET_NAME: z.string().min(1, 'AWS S3 Bucket Name is required'),
  
  ADMIN_EMAIL: z.string().email('Valid Admin Email is required'),
  ADMIN_PASSWORD: z.string().min(6, 'Admin Password must be at least 6 characters'),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:\n', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
