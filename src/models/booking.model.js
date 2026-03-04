import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
      index: true,
    },
    eventDetails: {
      date: { type: Date, required: true },
      type: { type: String, required: true }, // array of strings maybe? e.g. 'Ramleela', 'Sundarkand'
      expectedAudienceSize: { type: Number },
      specialRequirements: { type: String },
    },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      pinCode: { type: String },
    },
    pricing: {
      agreedPrice: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'REFUNDED', 'FAILED'],
      default: 'PENDING',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment', // Resolves when payment module is built
    }
  },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);
