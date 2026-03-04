import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const TRAVELING_FEE = 500;

export const createOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Order items are required');
  }

  const orderItems = items.map((item) => ({
    serviceName: item.serviceName,
    packageTitle: item.packageTitle,
    price: item.price,
    dateTime: item.dateTime,
    date: item.date,
    addressDetail: item.addressDetail,
    addressLabel: item.addressLabel,
  }));

  const totalAmount = orderItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const grandTotal = totalAmount + TRAVELING_FEE;

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    totalAmount,
    travelingFee: TRAVELING_FEE,
    grandTotal,
    paymentStatus: 'PENDING',
  });

  res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
});

export const getUserOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, orders, 'User orders fetched'));
});
