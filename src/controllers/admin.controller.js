import { Artist } from '../models/artist.model.js';
import { Booking } from '../models/booking.model.js';
import { Category } from '../models/category.model.js';
import { Payment } from '../models/payment.model.js';
import { Review } from '../models/review.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getAdminMe = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, req.user, 'Admin profile fetched'));
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalArtists, pendingArtistsCount, totalBookings, revenueData, recentBookings, bookingsByStatus, bookingTrend] =
    await Promise.all([
      User.countDocuments({ role: 'USER' }),
      Artist.countDocuments(),
      Artist.countDocuments({ status: 'PENDING' }),
      Booking.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'SUCCESS' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
      ]),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name phone')
        .populate('artist', 'name'),
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
        stats: { totalUsers, totalArtists, pendingArtistsCount, totalBookings, totalRevenue },
        recentBookings,
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

export const approveRejectArtist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'Invalid status. Use APPROVED or REJECTED');
  }

  const artist = await Artist.findByIdAndUpdate(id, { $set: { status } }, { new: true }).select('-refreshToken');
  if (!artist) throw new ApiError(404, 'Artist not found');

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

  const normalizedPhone = String(phone).replace(/\D/g, '').slice(-10);
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
    location: {},
  });

  res.status(201).json(
    new ApiResponse(201, artist, 'Artist created successfully')
  );
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;

  const [bookings, totalCount] = await Promise.all([
    Booking.find(query)
      .populate('user', 'name phone email')
      .populate('artist', 'name location')
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
    .populate('paymentId');
  if (!booking) throw new ApiError(404, 'Booking not found');
  res.status(200).json(new ApiResponse(200, booking, 'Booking details fetched'));
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
