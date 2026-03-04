import { env } from '../config/env.js';
import { Artist } from '../models/artist.model.js';
import { OTP } from '../models/otp.model.js';
import { User } from '../models/user.model.js';
import { sendSMS } from '../services/twilio.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Normalize phone to E.164 for Indian numbers (Twilio needs +91XXXXXXXXXX)
const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return phone;
  if (phone.startsWith('+')) return phone;
  return `+91${digits.slice(-10)}`;
};

// Helper to generate cookies
const generateAccessAndRefreshTokens = async (type, userId) => {
  let user;
  if (type === 'USER') {
    user = await User.findById(userId);
  } else if (type === 'ARTIST') {
    user = await Artist.findById(userId);
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

export const sendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) throw new ApiError(400, 'Phone number is required');

  const normalizedPhone = normalizePhone(phone);

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP in Database
  await OTP.create({
    phone: normalizedPhone,
    otp: otpCode,
    expiresAt: new Date(Date.now() + 5 * 60000), // 5 mins
  });

  // Send SMS via Twilio
  // Bypass: Twilio rejects "To" = "From". In dev, also allow mock when phone matches.
  const isSameAsTwilioNumber = normalizedPhone === env.TWILIO_PHONE_NUMBER;
  const useMockOtp =
    (env.NODE_ENV !== 'production' && isSameAsTwilioNumber);

  if (useMockOtp) {
    console.log(`[DEV MODE] OTP for ${normalizedPhone}: ${otpCode} (${isSameAsTwilioNumber ? 'To/From same - Twilio would reject' : 'mock SID'})`);
  } else {
    await sendSMS(normalizedPhone, `Your Shobhnam login OTP is ${otpCode}. It is valid for 5 minutes.`);
  }

  return res.status(200).json(
    new ApiResponse(200, null, 'OTP sent successfully')
  );
});

export const verifyOtpUser = asyncHandler(async (req, res) => {
  const { phone, otp, name, city } = req.body;
  
  if (!phone || !otp) throw new ApiError(400, 'Phone and OTP are required');

  const normalizedPhone = normalizePhone(phone);

  const record = await OTP.findOne({ phone: normalizedPhone, otp, isUsed: false });
  if (!record) throw new ApiError(400, 'Invalid or Expired OTP');

  record.isUsed = true;
  await record.save();

  // Check if User exists
  let user = await User.findOne({ phone: normalizedPhone });

  if (!user) {
    // Register flow
    if (!name) {
      throw new ApiError(400, 'Name is required for new user registration');
    }
    user = await User.create({ phone: normalizedPhone, name, city, role: 'USER' });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens('USER', user._id);

  const options = { httpOnly: true, secure: true };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(new ApiResponse(200, { user, accessToken, refreshToken }, 'User logged in successfully'));
});

export const verifyOtpArtist = asyncHandler(async (req, res) => {
  const { phone, otp, name, category, city } = req.body;
  
  if (!phone || !otp) throw new ApiError(400, 'Phone and OTP are required');

  const normalizedPhone = normalizePhone(phone);

  const record = await OTP.findOne({ phone: normalizedPhone, otp, isUsed: false });
  if (!record) throw new ApiError(400, 'Invalid or Expired OTP');

  record.isUsed = true;
  await record.save();

  // Check if Artist exists
  let artist = await Artist.findOne({ phone: normalizedPhone });

  if (!artist) {
    artist = await Artist.create({
      phone: normalizedPhone,
      name: name || undefined,
      status: 'PENDING',
      location: {},
    });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens('ARTIST', artist._id);

  const options = { httpOnly: true, secure: true };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(new ApiResponse(200, { artist, accessToken, refreshToken }, 'Artist logged in successfully'));
});

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const admin = await User.findOne({ email: email.toLowerCase(), role: 'ADMIN' }).select('+password');

  if (!admin) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordValid = await admin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = admin.generateAccessToken();

  const adminData = {
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, { token, admin: adminData }, 'Admin logged in successfully'));
});
