import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const artistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    profilePhoto: {
      type: String, // S3 URL
    },
    bio: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Ramleela', 'Sundarkand', 'Bhagwat Katha', 'Ramayan Path', 'Other'],
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    expertise: {
      type: String,
      trim: true,
    },
    ramleelaCharacter: {
      type: String,
      trim: true,
    },
    aadharCard: {
      type: String, // S3 URL
    },
    serviceLocation: {
      type: String,
      trim: true,
    },
    youtubeLink: {
      type: String,
      trim: true,
    },
    pricing: {
      basePrice: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      }
    },
    availability: {
      isAvailable: {
        type: Boolean,
        default: true
      }
      // Can add more complex availability later
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    languages: [{
      type: String,
    }],
    location: {
      city: { type: String },
      state: { type: String },
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    rating: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

// Generate Access Token (Roles included)
artistSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: 'ARTIST',
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    }
  );
};

// Generate Refresh Token
artistSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    }
  );
};

export const Artist = mongoose.model('Artist', artistSchema);
