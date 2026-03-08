import { Artist } from '../models/artist.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMyArtistProfile = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, req.user, 'Artist profile fetched successfully')
  );
});

/** Onit-style: single file upload, updates artist and returns URL */
export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file?.location) throw new ApiError(400, 'No file uploaded');

  const artist = await Artist.findByIdAndUpdate(
    req.user._id,
    { $set: { profilePhoto: req.file.location } },
    { new: true }
  ).select('-refreshToken');

  if (!artist) throw new ApiError(404, 'Artist not found');

  res.status(200).json(
    new ApiResponse(200, { fileSavedUrl: req.file.location, artist }, 'Profile photo uploaded')
  );
});

/** Onit-style: single file upload, updates artist and returns URL */
export const uploadAadharCard = asyncHandler(async (req, res) => {
  if (!req.file?.location) throw new ApiError(400, 'No file uploaded');

  const artist = await Artist.findByIdAndUpdate(
    req.user._id,
    { $set: { aadharCard: req.file.location } },
    { new: true }
  ).select('-refreshToken');

  if (!artist) throw new ApiError(404, 'Artist not found');

  res.status(200).json(
    new ApiResponse(200, { fileSavedUrl: req.file.location, artist }, 'Aadhar card uploaded')
  );
});

// Parse experience string like "10 years" to number
const parseExperienceYears = (experience) => {
  if (experience === undefined || experience === null || experience === '') return undefined;
  if (typeof experience === 'number') return experience;
  const match = String(experience).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
};

export const updateArtistProfile = asyncHandler(async (req, res) => {
  const {
    name,
    fullName,
    bio,
    category,
    gender,
    expertise,
    ramleelaCharacter,
    experience,
    experienceYears,
    basePrice,
    currency,
    isAvailable,
    languages,
    city,
    state,
    serviceLocation,
    youtubeLink,
  } = req.body;
  const updates = { $set: {} };

  // Flat fields
  const displayName = name || fullName;
  if (displayName) updates.$set.name = displayName;
  if (bio) updates.$set.bio = bio;
  if (category) updates.$set.category = category;
  if (gender) updates.$set.gender = gender;
  if (expertise) updates.$set.expertise = expertise;
  if (ramleelaCharacter) updates.$set.ramleelaCharacter = ramleelaCharacter;
  if (serviceLocation) updates.$set.serviceLocation = serviceLocation;
  if (youtubeLink !== undefined) updates.$set.youtubeLink = youtubeLink || '';

  const expYears = experienceYears !== undefined ? experienceYears : parseExperienceYears(experience);
  if (expYears !== undefined) updates.$set.experienceYears = expYears;

  // Nested fields
  if (basePrice !== undefined || currency) {
    if (!updates.$set.pricing) updates.$set.pricing = {};
    if (basePrice !== undefined) updates.$set['pricing.basePrice'] = basePrice;
    if (currency) updates.$set['pricing.currency'] = currency;
  }

  if (isAvailable !== undefined) {
    updates.$set['availability.isAvailable'] = isAvailable;
  }

  if (city || state) {
    if (city) updates.$set['location.city'] = city;
    if (state) updates.$set['location.state'] = state;
  }

  // Arrays
  if (languages) {
    updates.$set.languages = Array.isArray(languages) ? languages : [languages];
  }

  // File uploads - support both single (req.file) and multiple (req.files)
  if (req.file) {
    updates.$set.profilePhoto = req.file.location;
  }
  if (req.files) {
    if (req.files.profilePhoto?.[0]) updates.$set.profilePhoto = req.files.profilePhoto[0].location;
    if (req.files.aadharCard?.[0]) updates.$set.aadharCard = req.files.aadharCard[0].location;
  }

  const updatedArtist = await Artist.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  ).select('-refreshToken');

  if (!updatedArtist) {
    throw new ApiError(404, 'Artist not found');
  }

  res.status(200).json(
    new ApiResponse(200, updatedArtist, 'Profile updated successfully')
  );
});

export const getArtistDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const artist = await Artist.findById(id).select('-refreshToken');

  if (!artist) throw new ApiError(404, 'Artist not found');

  res.status(200).json(
    new ApiResponse(200, artist, 'Artist fetched successfully')
  );
});

export const listArtists = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    city,
    minPrice,
    maxPrice,
    minRating,
    search
  } = req.query;

  const query = { status: 'APPROVED' }; // Only show approved artists to the public

  if (category) query.category = category;
  if (city) query['location.city'] = { $regex: new RegExp(city, 'i') };
  
  if (minPrice || maxPrice) {
    query['pricing.basePrice'] = {};
    if (minPrice) query['pricing.basePrice'].$gte = Number(minPrice);
    if (maxPrice) query['pricing.basePrice'].$lte = Number(maxPrice);
  }

  if (minRating) {
    query['rating.averageRating'] = { $gte: Number(minRating) };
  }

  if (search) {
    query.name = { $regex: new RegExp(search, 'i') };
  }

  const skip = (page - 1) * limit;

  const [artists, totalCount] = await Promise.all([
    Artist.find(query).skip(skip).limit(Number(limit)).select('-refreshToken'),
    Artist.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  res.status(200).json(
    new ApiResponse(200, {
      artists,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages
      }
    }, 'Artists fetched successfully')
  );
});

export const approveRejectArtist = asyncHandler(async (req, res) => {
  // Admin only
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' or 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'Invalid status update. Choose APPROVED or REJECTED');
  }

  const artist = await Artist.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true }
  ).select('-refreshToken');

  if (!artist) throw new ApiError(404, 'Artist not found');

  res.status(200).json(
    new ApiResponse(200, artist, `Artist has been ${status.toLowerCase()}`)
  );
});
