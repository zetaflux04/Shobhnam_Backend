import { Artist } from '../models/artist.model.js';
import { Booking } from '../models/booking.model.js';
import { Category } from '../models/category.model.js';
import { Order } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { Review } from '../models/review.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const BANK_VERIFICATION_STATUS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
};

const normalizeIndianPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return String(phone || '').trim();
  return `+91${digits.slice(-10)}`;
};

const isArtistProfileComplete = (artist) =>
  Boolean(
    String(artist?.name || '').trim() &&
      String(artist?.expertise || '').trim() &&
      String(artist?.serviceLocation || '').trim() &&
      String(artist?.profilePhoto || '').trim() &&
      String(artist?.aadharCard || '').trim()
  );

const buildOnboardingProgress = (artist) => {
  const complete = isArtistProfileComplete(artist);
  const verified = artist?.status === 'APPROVED';
  return {
    applied: complete,
    accountSetup: complete,
    verified,
    allDone: verified && complete,
    lastUpdatedAt: new Date(),
  };
};

export const getAdminMe = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, req.user, 'Admin profile fetched'));
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalArtists,
    pendingArtistsCount,
    approvedArtistsCount,
    liveArtistsCount,
    pendingBankVerificationsCount,
    totalBookings,
    totalOrders,
    revenueData,
    recentBookings,
    recentOrders,
    bookingsByStatus,
    bookingTrend,
  ] =
    await Promise.all([
      User.countDocuments({ role: 'USER' }),
      Artist.countDocuments(),
      Artist.countDocuments({ status: 'PENDING' }),
      Artist.countDocuments({ status: 'APPROVED' }),
      Artist.countDocuments({ isLive: true }),
      Artist.countDocuments({ 'bankVerification.status': BANK_VERIFICATION_STATUS.PENDING }),
      Booking.countDocuments(),
      Order.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'SUCCESS' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
      ]),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name phone')
        .populate('artist', 'name'),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name phone'),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

  res.status(200).json(
    new ApiResponse(
      200,
      {
        stats: {
          totalUsers,
          totalArtists,
          pendingArtistsCount,
          approvedArtistsCount,
          liveArtistsCount,
          pendingBankVerificationsCount,
          totalBookings,
          totalOrders,
          totalRevenue,
        },
        recentBookings,
        recentOrders,
        bookingsByStatus,
        bookingTrend,
      },
      'Dashboard stats fetched'
    )
  );
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const skip = (page - 1) * limit;

  const query = { role: 'USER' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, totalCount] = await Promise.all([
    User.find(query).select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }, 'Users fetched')
  );
});

export const banUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndDelete(id); // Simple delete for ban

  if (!user) throw new ApiError(404, 'User not found');

  res.status(200).json(new ApiResponse(200, {}, 'User banned/deleted successfully'));
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new ApiError(400, 'Category name is required');

  const existing = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
  if (existing) throw new ApiError(409, 'Category already exists');

  const category = await Category.create({ name, description });
  res.status(201).json(new ApiResponse(201, category, 'Category created'));
});

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true });
  res.status(200).json(new ApiResponse(200, categories, 'Categories fetched'));
});

export const getCategoriesForAdmin = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, categories, 'Categories fetched'));
});

export const toggleCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, 'Category not found');

  category.isActive = !category.isActive;
  await category.save();

  res.status(200).json(new ApiResponse(200, category, 'Category toggled'));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, 'Category not found');
  res.status(200).json(new ApiResponse(200, {}, 'Category deleted'));
});

export const getArtistApplications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const skip = (page - 1) * limit;

  const query = { status: 'PENDING' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'location.city': { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [artists, totalCount] = await Promise.all([
    Artist.find(query).select('-refreshToken').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Artist.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      artists,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }, 'Artist applications fetched')
  );
});

export const getAllArtists = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '', status } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'location.city': { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.status = status;

  const [artists, totalCount] = await Promise.all([
    Artist.find(query).select('-refreshToken').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Artist.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      artists,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }, 'Artists fetched')
  );
});

export const getBankVerificationArtists = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '', status = BANK_VERIFICATION_STATUS.PENDING } = req.query;
  const skip = (page - 1) * limit;

  const allowedStatuses = Object.values(BANK_VERIFICATION_STATUS);
  if (status && !allowedStatuses.includes(status)) {
    throw new ApiError(400, `Invalid bank verification status. Allowed: ${allowedStatuses.join(', ')}`);
  }

  const query = {};
  if (status) query['bankVerification.status'] = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { 'bankDetails.accountHolderName': { $regex: search, $options: 'i' } },
      { 'bankDetails.bankName': { $regex: search, $options: 'i' } },
      { 'bankDetails.ifscCode': { $regex: search, $options: 'i' } },
    ];
  }

  const [artists, totalCount] = await Promise.all([
    Artist.find(query).select('-refreshToken').sort({ 'bankVerification.submittedAt': -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
    Artist.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        artists,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      'Bank verification artists fetched'
    )
  );
});

export const reviewArtistBankVerification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (![BANK_VERIFICATION_STATUS.VERIFIED, BANK_VERIFICATION_STATUS.REJECTED].includes(status)) {
    throw new ApiError(400, 'Invalid status. Use VERIFIED or REJECTED');
  }
  if (status === BANK_VERIFICATION_STATUS.REJECTED && !String(reason || '').trim()) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const artist = await Artist.findById(id).select('-refreshToken');
  if (!artist) throw new ApiError(404, 'Artist not found');

  const currentStatus = artist.bankVerification?.status || BANK_VERIFICATION_STATUS.NOT_SUBMITTED;
  if (currentStatus !== BANK_VERIFICATION_STATUS.PENDING) {
    throw new ApiError(400, 'Only pending bank verifications can be reviewed');
  }

  artist.bankVerification = {
    ...(artist.bankVerification || {}),
    status,
    reviewedAt: new Date(),
    reviewedBy: req.user?._id,
    rejectionReason: status === BANK_VERIFICATION_STATUS.REJECTED ? String(reason).trim() : '',
  };
  await artist.save();

  res.status(200).json(
    new ApiResponse(
      200,
      artist,
      status === BANK_VERIFICATION_STATUS.VERIFIED ? 'Bank verification approved' : 'Bank verification rejected'
    )
  );
});

export const approveRejectArtist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'Invalid status. Use APPROVED or REJECTED');
  }

  const artist = await Artist.findByIdAndUpdate(id, { $set: { status } }, { new: true }).select('-refreshToken');
  if (!artist) throw new ApiError(404, 'Artist not found');

  artist.onboardingProgress = buildOnboardingProgress(artist);
  artist.isLive = artist.onboardingProgress.allDone;
  await artist.save({ validateBeforeSave: false });

  res.status(200).json(new ApiResponse(200, artist, `Artist ${status.toLowerCase()}`));
});

export const deleteArtist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const artist = await Artist.findByIdAndDelete(id);
  if (!artist) throw new ApiError(404, 'Artist not found');
  res.status(200).json(new ApiResponse(200, {}, 'Artist deleted'));
});

/** Upload-only: returns S3 URL without updating any artist */
export const uploadProfilePhotoAdmin = asyncHandler(async (req, res) => {
  if (!req.file?.location) throw new ApiError(400, 'No file uploaded');
  res.status(200).json(
    new ApiResponse(200, { fileSavedUrl: req.file.location }, 'Profile photo uploaded')
  );
});

/** Upload-only: returns S3 URL without updating any artist */
export const uploadAadharAdmin = asyncHandler(async (req, res) => {
  if (!req.file?.location) throw new ApiError(400, 'No file uploaded');
  res.status(200).json(
    new ApiResponse(200, { fileSavedUrl: req.file.location }, 'Aadhar card uploaded')
  );
});

export const uploadPanCardAdmin = asyncHandler(async (req, res) => {
  if (!req.file?.location) throw new ApiError(400, 'No file uploaded');
  res.status(200).json(
    new ApiResponse(200, { fileSavedUrl: req.file.location }, 'PAN card uploaded')
  );
});

const parseExperienceYears = (experience) => {
  if (experience === undefined || experience === null || experience === '') return undefined;
  if (typeof experience === 'number') return experience;
  const match = String(experience).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
};

const expertiseToCategory = {
  'Ramleela artist': 'Ramleela',
  'Classical singer': 'Other',
  Instrumentalist: 'Other',
};

export const createArtist = asyncHandler(async (req, res) => {
  const {
    phone,
    name,
    fullName,
    gender,
    expertise,
    experience,
    experienceYears,
    ramleelaCharacter,
    serviceLocation,
    youtubeLink,
    profilePhoto,
    aadharCard,
  } = req.body;

  const displayName = (name || fullName || '').trim();
  if (!displayName) throw new ApiError(400, 'Full name is required');
  if (!phone || String(phone).trim().length < 10) throw new ApiError(400, 'Valid phone number is required');
  if (!gender) throw new ApiError(400, 'Gender is required');
  if (!expertise) throw new ApiError(400, 'Expertise is required');
  if (!serviceLocation || !String(serviceLocation).trim()) throw new ApiError(400, 'Service location is required');
  if (!profilePhoto || !String(profilePhoto).trim()) throw new ApiError(400, 'Profile photo is required');
  if (!aadharCard || !String(aadharCard).trim()) throw new ApiError(400, 'Aadhar card is required');

  const normalizedPhone = normalizeIndianPhone(phone);
  const existing = await Artist.findOne({ phone: normalizedPhone });
  if (existing) throw new ApiError(409, 'An artist with this phone number already exists');

  const requireCharacter = expertise.toLowerCase().includes('ramleela');
  if (requireCharacter && (!ramleelaCharacter || !String(ramleelaCharacter).trim())) {
    throw new ApiError(400, 'Ramleela character is required when expertise includes Ramleela');
  }

  const expYears = experienceYears !== undefined ? experienceYears : parseExperienceYears(experience);
  const category = expertiseToCategory[expertise] || 'Other';

  const artist = await Artist.create({
    phone: normalizedPhone,
    name: displayName,
    gender,
    expertise,
    category,
    ramleelaCharacter: ramleelaCharacter?.trim() || undefined,
    experienceYears: expYears ?? 0,
    serviceLocation: String(serviceLocation).trim(),
    youtubeLink: youtubeLink?.trim() || '',
    profilePhoto: String(profilePhoto).trim(),
    aadharCard: String(aadharCard).trim(),
    status: 'PENDING',
    onboardingProgress: {
      applied: true,
      accountSetup: true,
      verified: false,
      allDone: false,
      lastUpdatedAt: new Date(),
    },
    bankVerification: {
      status: BANK_VERIFICATION_STATUS.NOT_SUBMITTED,
    },
    isLive: false,
    location: {},
  });

  res.status(201).json(
    new ApiResponse(201, artist, 'Artist created successfully')
  );
});

const isSameId = (left, right) => String(left) === String(right);

const getBookingAssignedArtists = (booking) => {
  const currentEntries = Array.isArray(booking.assignedArtists) ? [...booking.assignedArtists] : [];
  const hasLegacyArtist = booking.artist && !currentEntries.some((entry) => isSameId(entry.artist, booking.artist));

  if (!hasLegacyArtist) return currentEntries;

  return [
    {
      artist: booking.artist,
      assignedBy: booking.assignment?.assignedBy,
      assignedAt: booking.assignment?.assignedAt || booking.updatedAt || booking.createdAt || new Date(),
      source: booking.assignment?.source || 'ADMIN',
      note: booking.assignment?.note,
    },
    ...currentEntries,
  ];
};

const syncLegacyAssignmentFields = (booking, assignedArtists) => {
  booking.assignedArtists = assignedArtists;
  const primaryAssignment = assignedArtists[0];

  if (!primaryAssignment) {
    booking.artist = undefined;
    booking.assignment = undefined;
    return;
  }

  booking.artist = primaryAssignment.artist;
  booking.assignment = {
    assignedBy: primaryAssignment.assignedBy,
    assignedAt: primaryAssignment.assignedAt,
    source: primaryAssignment.source,
    note: primaryAssignment.note,
  };
};

const getOrderItemAssignedArtists = (orderItem) => {
  const currentEntries = Array.isArray(orderItem.assignedArtists) ? [...orderItem.assignedArtists] : [];
  const hasLegacyArtist = orderItem.artist && !currentEntries.some((entry) => isSameId(entry.artist, orderItem.artist));

  if (!hasLegacyArtist) return currentEntries;

  return [
    {
      artist: orderItem.artist,
      assignedBy: orderItem.assignment?.assignedBy,
      assignedAt: orderItem.assignment?.assignedAt || new Date(),
      source: orderItem.assignment?.source || 'ADMIN',
      note: orderItem.assignment?.note,
    },
    ...currentEntries,
  ];
};

const syncOrderItemLegacyAssignmentFields = (orderItem, assignedArtists) => {
  orderItem.assignedArtists = assignedArtists;
  const primaryAssignment = assignedArtists[0];

  if (!primaryAssignment) {
    orderItem.artist = undefined;
    orderItem.assignment = undefined;
    return;
  }

  orderItem.artist = primaryAssignment.artist;
  orderItem.assignment = {
    assignedBy: primaryAssignment.assignedBy,
    assignedAt: primaryAssignment.assignedAt,
    source: primaryAssignment.source,
    note: primaryAssignment.note,
  };
};

const buildOrderItemEventDate = (orderItem) => {
  const candidate = orderItem?.date || orderItem?.dateTime;
  const date = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const buildOrderItemSlot = (orderItem) => {
  const validSlots = ['9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
  return validSlots.includes(orderItem?.slot) ? orderItem.slot : '9:00 AM';
};

const buildOrderItemTypeLabel = (orderItem) => {
  const type = [orderItem?.serviceName, orderItem?.packageTitle].filter(Boolean).join(' - ');
  return type || 'Order package';
};

const syncLinkedBookingForOrderItem = async (order, itemIndex, assignedArtists) => {
  const orderItem = order.items[itemIndex];
  if (!orderItem) return;

  const linkedBooking = await Booking.findOne({
    sourceType: 'ORDER_ITEM',
    'sourceRef.orderId': order._id,
    'sourceRef.itemIndex': itemIndex,
  });

  if (!assignedArtists.length) {
    if (!linkedBooking) return;
    syncLegacyAssignmentFields(linkedBooking, []);
    if (linkedBooking.status === 'PENDING' || linkedBooking.status === 'CONFIRMED') {
      linkedBooking.status = 'CANCELLED';
    }
    await linkedBooking.save();
    return;
  }

  const bookingData = {
    user: order.user,
    eventDetails: {
      date: buildOrderItemEventDate(orderItem),
      slot: buildOrderItemSlot(orderItem),
      type: buildOrderItemTypeLabel(orderItem),
    },
    location: {
      address: orderItem.addressDetail || 'Address unavailable',
      city: orderItem.city || 'City unavailable',
      pinCode: orderItem.pinCode,
    },
    pricing: {
      agreedPrice: Number(orderItem.price || 0),
      currency: order.currency || 'INR',
    },
    paymentStatus: ['PENDING', 'PAID', 'REFUNDED', 'FAILED'].includes(order.paymentStatus)
      ? order.paymentStatus
      : 'PENDING',
    sourceType: 'ORDER_ITEM',
    sourceRef: {
      orderId: order._id,
      itemIndex,
    },
  };

  const booking = linkedBooking || new Booking(bookingData);
  booking.user = bookingData.user;
  booking.eventDetails = bookingData.eventDetails;
  booking.location = bookingData.location;
  booking.pricing = bookingData.pricing;
  booking.paymentStatus = bookingData.paymentStatus;
  booking.sourceType = bookingData.sourceType;
  booking.sourceRef = bookingData.sourceRef;
  if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
    booking.status = 'PENDING';
  }

  syncLegacyAssignmentFields(booking, assignedArtists);
  await booking.save();
};

export const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;

  const [bookings, totalCount] = await Promise.all([
    Booking.find(query)
      .populate('user', 'name phone email')
      .populate('artist', 'name location')
      .populate('assignedArtists.artist', 'name phone category location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }, 'Bookings fetched')
  );
});

export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id)
    .populate('user', 'name phone email city')
    .populate('artist', 'name phone email location pricing')
    .populate('assignedArtists.artist', 'name phone email category location pricing')
    .populate('paymentId');
  if (!booking) throw new ApiError(404, 'Booking not found');
  res.status(200).json(new ApiResponse(200, booking, 'Booking details fetched'));
});

export const assignArtistToBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { artistId, note } = req.body;

  if (!artistId) throw new ApiError(400, 'artistId is required');

  const [booking, artist] = await Promise.all([
    Booking.findById(id),
    Artist.findById(artistId),
  ]);

  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!artist) throw new ApiError(404, 'Artist not found');
  if (artist.status !== 'APPROVED') {
    throw new ApiError(400, 'Only approved artists can be assigned');
  }

  const assignedArtists = getBookingAssignedArtists(booking);
  const alreadyAssigned = assignedArtists.some((entry) => isSameId(entry.artist, artist._id));
  if (alreadyAssigned) {
    throw new ApiError(409, 'Artist is already assigned to this booking');
  }

  assignedArtists.push({
    artist: artist._id,
    assignedBy: req.user._id,
    assignedAt: new Date(),
    source: 'ADMIN',
    note: note ? String(note).trim() : undefined,
  });

  syncLegacyAssignmentFields(booking, assignedArtists);

  await booking.save();
  await booking.populate('artist', 'name phone category');
  await booking.populate('assignedArtists.artist', 'name phone category location');

  res.status(200).json(new ApiResponse(200, booking, 'Artist assigned to booking'));
});

export const unassignArtistFromBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { artistId } = req.body;

  if (!artistId) throw new ApiError(400, 'artistId is required');

  const booking = await Booking.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const assignedArtists = getBookingAssignedArtists(booking);
  const updatedAssignedArtists = assignedArtists.filter((entry) => !isSameId(entry.artist, artistId));

  if (updatedAssignedArtists.length === assignedArtists.length) {
    throw new ApiError(404, 'Artist is not assigned to this booking');
  }

  syncLegacyAssignmentFields(booking, updatedAssignedArtists);

  await booking.save();
  await booking.populate('artist', 'name phone category');
  await booking.populate('assignedArtists.artist', 'name phone category location');

  res.status(200).json(new ApiResponse(200, booking, 'Artist unassigned from booking'));
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, paymentStatus = '', search = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query = {};
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (search) {
    query.$or = [
      { 'items.serviceName': { $regex: search, $options: 'i' } },
      { 'items.packageTitle': { $regex: search, $options: 'i' } },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    Order.find(query)
      .populate('user', 'name phone email')
      .populate('items.artist', 'name phone category')
      .populate('items.assignedArtists.artist', 'name phone category location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      'Orders fetched'
    )
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id)
    .populate('user', 'name phone email city')
    .populate('items.artist', 'name phone email category location')
    .populate('items.assignedArtists.artist', 'name phone email category location');
  if (!order) throw new ApiError(404, 'Order not found');
  res.status(200).json(new ApiResponse(200, order, 'Order details fetched'));
});

export const assignArtistToOrderItem = asyncHandler(async (req, res) => {
  const { id, itemIndex } = req.params;
  const { artistId, artistIds, note } = req.body;
  const incomingArtistIds = [artistId, ...(Array.isArray(artistIds) ? artistIds : [])]
    .filter(Boolean)
    .map((value) => String(value));
  const uniqueArtistIds = [...new Set(incomingArtistIds)];

  if (!uniqueArtistIds.length) {
    throw new ApiError(400, 'artistId or artistIds is required');
  }

  const [order, artists] = await Promise.all([
    Order.findById(id),
    Artist.find({ _id: { $in: uniqueArtistIds } }),
  ]);
  if (!order) throw new ApiError(404, 'Order not found');
  if (artists.length !== uniqueArtistIds.length) throw new ApiError(404, 'One or more artists were not found');

  const hasUnapprovedArtist = artists.some((artist) => artist.status !== 'APPROVED');
  if (hasUnapprovedArtist) throw new ApiError(400, 'Only approved artists can be assigned');

  const parsedItemIndex = Number(itemIndex);
  if (!Number.isInteger(parsedItemIndex) || parsedItemIndex < 0 || parsedItemIndex >= order.items.length) {
    throw new ApiError(400, 'Invalid item index');
  }

  const targetItem = order.items[parsedItemIndex];
  const assignedArtists = getOrderItemAssignedArtists(targetItem);
  const noteValue = note ? String(note).trim() : undefined;
  let addedCount = 0;

  for (const artist of artists) {
    const alreadyAssigned = assignedArtists.some((entry) => isSameId(entry.artist, artist._id));
    if (alreadyAssigned) continue;

    assignedArtists.push({
      artist: artist._id,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      source: 'ADMIN',
      note: noteValue,
    });
    addedCount += 1;
  }

  if (!addedCount) {
    throw new ApiError(409, 'Selected artists are already assigned to this package');
  }

  syncOrderItemLegacyAssignmentFields(targetItem, assignedArtists);

  await order.save();
  await syncLinkedBookingForOrderItem(order, parsedItemIndex, assignedArtists);
  await order.populate('items.artist', 'name phone category');
  await order.populate('items.assignedArtists.artist', 'name phone category location');

  res.status(200).json(new ApiResponse(200, order, 'Artist assigned to package'));
});

export const unassignArtistFromOrderItem = asyncHandler(async (req, res) => {
  const { id, itemIndex } = req.params;
  const { artistId } = req.body || {};
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, 'Order not found');

  const parsedItemIndex = Number(itemIndex);
  if (!Number.isInteger(parsedItemIndex) || parsedItemIndex < 0 || parsedItemIndex >= order.items.length) {
    throw new ApiError(400, 'Invalid item index');
  }

  const targetItem = order.items[parsedItemIndex];
  const assignedArtists = getOrderItemAssignedArtists(targetItem);
  const updatedAssignedArtists = artistId
    ? assignedArtists.filter((entry) => !isSameId(entry.artist, artistId))
    : [];

  if (artistId && updatedAssignedArtists.length === assignedArtists.length) {
    throw new ApiError(404, 'Artist is not assigned to this package');
  }

  syncOrderItemLegacyAssignmentFields(targetItem, updatedAssignedArtists);

  await order.save();
  await syncLinkedBookingForOrderItem(order, parsedItemIndex, updatedAssignedArtists);
  await order.populate('items.artist', 'name phone category');
  await order.populate('items.assignedArtists.artist', 'name phone category location');

  res.status(200).json(new ApiResponse(200, order, artistId ? 'Artist unassigned from package' : 'All artists unassigned from package'));
});

export const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const [reviews, totalCount] = await Promise.all([
    Review.find()
      .populate('user', 'name phone')
      .populate('artist', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments(),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }, 'Reviews fetched')
  );
});

export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const review = await Review.findById(id);
  if (!review) throw new ApiError(404, 'Review not found');

  const artistId = review.artist;
  await review.deleteOne();

  const remainingReviews = await Review.find({ artist: artistId });
  const totalReviews = remainingReviews.length;
  const newAverage = totalReviews > 0
    ? remainingReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  await Artist.findByIdAndUpdate(artistId, {
    rating: { averageRating: newAverage, totalReviews },
  });

  res.status(200).json(new ApiResponse(200, {}, 'Review deleted'));
});
