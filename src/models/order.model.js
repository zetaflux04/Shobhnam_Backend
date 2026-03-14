import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true },
    packageTitle: { type: String, required: true },
    price: { type: Number, required: true },
    dateTime: { type: String },
    date: { type: Date },
    slot: { type: String, enum: ['9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'] },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
    },
    addressDetail: { type: String },
    addressLabel: { type: String },
    city: { type: String },
    pinCode: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    travelingFee: {
      type: Number,
      default: 500,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);
