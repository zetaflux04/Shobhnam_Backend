import { Booking } from '../models/booking.model.js';
import { Order } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { razorpayInstance, verifyRazorpaySignature, verifyWebhookSignature } from '../services/razorpay.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { bookingId, orderId } = req.body;

  if (bookingId) {
    // Artist booking payment
    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.status !== 'CONFIRMED') throw new ApiError(400, 'Only confirmed bookings can be paid for');

    const amountInPaise = Math.round(booking.pricing.agreedPrice * 100);

    const options = {
      amount: amountInPaise,
      currency: booking.pricing.currency || 'INR',
      receipt: `receipt_booking_${booking._id}`,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    if (!razorpayOrder) {
      throw new ApiError(500, 'Failed to create Razorpay order');
    }

    const payment = await Payment.create({
      booking: booking._id,
      user: req.user._id,
      artist: booking.artist,
      razorpayOrderId: razorpayOrder.id,
      amount: booking.pricing.agreedPrice,
      currency: booking.pricing.currency || 'INR',
      status: 'CREATED',
    });

    return res.status(200).json(
      new ApiResponse(200, { order: razorpayOrder, paymentId: payment._id }, 'Razorpay order created successfully')
    );
  }

  if (orderId) {
    // Cart/order payment
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.paymentStatus === 'PAID') throw new ApiError(400, 'Order already paid');

    const amountInPaise = Math.round(order.grandTotal * 100);

    const options = {
      amount: amountInPaise,
      currency: order.currency || 'INR',
      receipt: `receipt_order_${order._id}`,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    if (!razorpayOrder) {
      throw new ApiError(500, 'Failed to create Razorpay order');
    }

    const payment = await Payment.create({
      order: order._id,
      user: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.grandTotal,
      currency: order.currency || 'INR',
      status: 'CREATED',
    });

    return res.status(200).json(
      new ApiResponse(200, { order: razorpayOrder, paymentId: payment._id }, 'Razorpay order created successfully')
    );
  }

  throw new ApiError(400, 'Either bookingId or orderId is required');
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ApiError(400, 'Payment details are missing');
  }

  const isSignatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (!isSignatureValid) {
    throw new ApiError(400, 'Invalid payment signature');
  }

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) throw new ApiError(404, 'Payment record not found');

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  payment.status = 'SUCCESS';
  await payment.save();

  // Update Booking or Order Status
  if (payment.booking) {
    await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: 'PAID', paymentId: payment._id });
  }
  if (payment.order) {
    await Order.findByIdAndUpdate(payment.order, { paymentStatus: 'PAID', paymentId: payment._id });
  }

  res.status(200).json(new ApiResponse(200, payment, 'Payment verified successfully'));
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(400).send('Invalid signature');
  }

  // Handle various webhook events (e.g. payment.captured, payment.failed)
  const event = req.body.event;
  if (event === 'payment.captured') {
    const paymentEntity = req.body.payload.payment.entity;
    const orderId = paymentEntity.order_id;
    
    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (payment && payment.status !== 'SUCCESS') {
      payment.status = 'SUCCESS';
      payment.razorpayPaymentId = paymentEntity.id;
      await payment.save();
      if (payment.booking) {
        await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: 'PAID', paymentId: payment._id });
      }
      if (payment.order) {
        await Order.findByIdAndUpdate(payment.order, { paymentStatus: 'PAID', paymentId: payment._id });
      }
    }
  }

  res.status(200).send('OK');
});
