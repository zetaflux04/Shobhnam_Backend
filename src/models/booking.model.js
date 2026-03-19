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
      index: true,
    },
    eventDetails: {
      date: { type: Date, required: true },
      slot: { type: String, enum: ['6AM-12PM', '12PM-6PM', '6PM-12AM', '12AM-6AM'], required: true },
      type: { type: String, required: true }, // array of strings maybe? e.g. 'Ramleela', 'Sundarkand'
      expectedAudienceSize: { type: Number },
      specialRequirements: { type: String },
    },
    location: {
      addressId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
      },
      address: { type: String, required: true },
      city: { type: String, required: true },
      pinCode: { type: String },
      saveAs: { type: String },
      recipientName: { type: String },
      recipientPhone: { type: String },
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
    },
    assignment: {
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      assignedAt: {
        type: Date,
      },
      source: {
        type: String,
        enum: ['ADMIN', 'RAMLEELA_CUSTOMIZATION'],
      },
      note: {
        type: String,
        trim: true,
      },
    },
    assignedArtists: [
      {
        artist: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Artist',
          required: true,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        source: {
          type: String,
          enum: ['ADMIN', 'RAMLEELA_CUSTOMIZATION'],
        },
        note: {
          type: String,
          trim: true,
        },
      },
    ],
    sourceType: {
      type: String,
      enum: ['DIRECT_BOOKING', 'ORDER_ITEM'],
      default: 'DIRECT_BOOKING',
      index: true,
    },
    sourceRef: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
      itemIndex: {
        type: Number,
      },
    },
  },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);
