import { Artist } from '../models/artist.model.js';
import { Booking } from '../models/booking.model.js';
import { Review } from '../models/review.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const submitReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  if (!bookingId || !rating) throw new ApiError(400, 'Booking ID and Rating are required');

  const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== 'COMPLETED') throw new ApiError(400, 'Can only review completed bookings');

  const existingReview = await Review.findOne({ booking: bookingId });
  if (existingReview) throw new ApiError(400, 'You have already reviewed this booking');

  const review = await Review.create({
    user: req.user._id,
    artist: booking.artist,
    booking: booking._id,
    rating,
    comment,
  });

  // Calculate new average rating for artist
  const artist = await Artist.findById(booking.artist);
  const totalReviews = artist.rating.totalReviews + 1;
  const newAverage = ((artist.rating.averageRating * artist.rating.totalReviews) + rating) / totalReviews;
  
  artist.rating.totalReviews = totalReviews;
  artist.rating.averageRating = newAverage;
  await artist.save();

  res.status(201).json(new ApiResponse(201, review, 'Review submitted successfully'));
});

export const getArtistReviews = asyncHandler(async (req, res) => {
  const { artistId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const [reviews, totalCount] = await Promise.all([
    Review.find({ artist: artistId })
      .populate('user', 'name profilePhoto city')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments({ artist: artistId })
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    }, 'Artist reviews fetched')
  );
});

export const deleteReviewAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) throw new ApiError(404, 'Review not found');

  const artistId = review.artist;
  
  await review.deleteOne();

  // Recalculate Artist Rating
  const remainingReviews = await Review.find({ artist: artistId });
  const totalReviews = remainingReviews.length;
  const newAverage = totalReviews > 0 
    ? remainingReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
    : 0;
    
  await Artist.findByIdAndUpdate(artistId, {
    rating: {
      averageRating: newAverage,
      totalReviews: totalReviews
    }
  });

  res.status(200).json(new ApiResponse(200, {}, 'Review deleted and artist rating updated'));
});
