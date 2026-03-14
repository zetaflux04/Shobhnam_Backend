import { env } from '../config/env.js';
import { Address } from '../models/address.model.js';
import { Artist } from '../models/artist.model.js';
import { Booking } from '../models/booking.model.js';
import { sendSMS } from '../services/twilio.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const mockSmsCheck = async (phone, msg) => {
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV SMS to ${phone}]: ${msg}`);
  } else {
    try {
      await sendSMS(phone, msg);
    } catch (e) {
      console.error('Failed to send SMS Notification', e);
    }
  }
};

const ALLOWED_SLOTS = new Set(['9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM']);

export const createBooking = asyncHandler(async (req, res) => {
  const {
    artistId,
    date,
    slot,
    type,
    expectedAudienceSize,
    specialRequirements,
    addressId,
    address,
    city,
    pinCode,
    addressLabel,
    recipientName,
    recipientPhone,
  } = req.body;

  if (!date || Number.isNaN(new Date(date).getTime())) {
    throw new ApiError(400, 'Valid event date is required');
  }
  if (!ALLOWED_SLOTS.has(slot)) {
    throw new ApiError(400, 'Invalid slot. Allowed slots are 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM');
  }
  if (!type) {
    throw new ApiError(400, 'Event type is required');
  }

  const artist = await Artist.findById(artistId);
  if (!artist) throw new ApiError(404, 'Artist not found');
  if (artist.status !== 'APPROVED') throw new ApiError(400, 'Artist is not available for booking');

  let resolvedAddress = String(address ?? '').trim();
  let resolvedCity = String(city ?? '').trim();
  let resolvedPinCode = String(pinCode ?? '').trim();
  let resolvedAddressLabel = String(addressLabel ?? '').trim();
  let resolvedRecipientName = String(recipientName ?? '').trim();
  let resolvedRecipientPhone = String(recipientPhone ?? '').trim();
  let resolvedAddressId = null;

  if (addressId) {
    const ownedAddress = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!ownedAddress) {
      throw new ApiError(404, 'Address not found for this user');
    }
    resolvedAddressId = ownedAddress._id;
    resolvedAddress = [ownedAddress.houseFloor, ownedAddress.towerBlock, ownedAddress.landmark]
      .filter(Boolean)
      .join(', ');
    resolvedCity = ownedAddress.city;
    resolvedPinCode = ownedAddress.pinCode;
    resolvedAddressLabel = ownedAddress.saveAs;
    resolvedRecipientName = ownedAddress.recipientName;
    resolvedRecipientPhone = ownedAddress.recipientPhone;
  }

  if (!resolvedAddress || !resolvedCity) {
    throw new ApiError(400, 'Address and city are required');
  }

  const newBooking = await Booking.create({
    user: req.user._id,
    artist: artistId,
    eventDetails: { date: new Date(date), slot, type, expectedAudienceSize, specialRequirements },
    location: {
      addressId: resolvedAddressId,
      address: resolvedAddress,
      city: resolvedCity,
      pinCode: resolvedPinCode,
      saveAs: resolvedAddressLabel,
      recipientName: resolvedRecipientName,
      recipientPhone: resolvedRecipientPhone,
    },
    pricing: { agreedPrice: artist.pricing.basePrice, currency: artist.pricing.currency },
    status: 'PENDING'
  });

  // Notify Artist
  await mockSmsCheck(
    artist.phone,
    `You have a new booking request for ${type} on ${new Date(date).toDateString()} at ${slot}. Check your Shobhnam app.`
  );

  res.status(201).json(new ApiResponse(201, newBooking, 'Booking request sent successfully'));
});

export const respondToBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'CONFIRMED' or 'REJECTED'

  if (!['CONFIRMED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'Invalid status. Can only be CONFIRMED or REJECTED');
  }

  const booking = await Booking.findOne({ _id: id, artist: req.user._id }).populate('user', 'name phone');
  if (!booking) throw new ApiError(404, 'Booking not found or not assigned to you');

  if (booking.status !== 'PENDING') {
    throw new ApiError(400, `Cannot change status from ${booking.status}`);
  }

  booking.status = status;
  await booking.save();

  // Notify User
  await mockSmsCheck(
    booking.user.phone, 
    `Your Shobhnam booking for ${booking.eventDetails.type} has been ${status} by the artist.`
  );

  res.status(200).json(new ApiResponse(200, booking, `Booking successfully ${status}`));
});

export const completeBooking = asyncHandler(async (req, res) => {
  // Can be marked completed by User or Artist depending on business logic, here we allow both optionally
  const { id } = req.params;
  
  const query = { _id: id };
  if (req.user.role === 'ARTIST') query.artist = req.user._id;
  if (req.user.role === 'USER') query.user = req.user._id;

  const booking = await Booking.findOne(query);
  if (!booking) throw new ApiError(404, 'Booking not found');

  if (booking.status !== 'CONFIRMED') {
    throw new ApiError(400, 'Only confirmed bookings can be marked as completed');
  }

  booking.status = 'COMPLETED';
  await booking.save();

  res.status(200).json(new ApiResponse(200, booking, 'Booking marked as completed'));
});

export const getUserBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate('artist', 'name category profilePhoto pricing')
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, 'User bookings fetched'));
});

export const getArtistBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ artist: req.user._id })
    .populate('user', 'name city profilePhoto phone')
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, 'Artist bookings fetched'));
});

export const getAllBookingsAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const query = {};
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [bookings, totalCount] = await Promise.all([
    Booking.find(query)
      .populate('user', 'name phone')
      .populate('artist', 'name category phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(query)
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    }, 'All bookings fetched successfully')
  );
});
