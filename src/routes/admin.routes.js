import { Router } from 'express';
import {
  assignArtistToBooking,
  approveRejectArtist,
  banUser,
  createArtist,
  createCategory,
  deleteArtist,
  deleteCategory,
  deleteReview,
  getAdminMe,
  getAllArtists,
  getBankVerificationArtists,
  getArtistApplications,
  getAllBookings,
  getAllReviews,
  getAllUsers,
  getBookingById,
  getCategories,
  getCategoriesForAdmin,
  getDashboardStats,
  reviewArtistBankVerification,
  toggleCategory,
  unassignArtistFromBooking,
  uploadAadharAdmin,
  uploadPanCardAdmin,
  uploadProfilePhotoAdmin,
} from '../controllers/admin.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../services/s3.service.js';
import { uploadWithErrorHandling } from '../utils/uploadUtils.js';

const router = Router();

// Publicly readable categories
router.get('/categories', getCategories);

// Admin + Artist: shared upload endpoints (used by app and admin dashboard)
router.use(verifyJWT);
router.post('/upload-artist-profile-photo', authorizeRoles('ADMIN', 'ARTIST'), ...uploadWithErrorHandling(uploadSingle('profilePhoto'), uploadProfilePhotoAdmin));
router.post('/upload-artist-aadhar', authorizeRoles('ADMIN', 'ARTIST'), ...uploadWithErrorHandling(uploadSingle('aadharCard'), uploadAadharAdmin));
router.post('/upload-artist-pan-card', authorizeRoles('ADMIN', 'ARTIST'), ...uploadWithErrorHandling(uploadSingle('panCard'), uploadPanCardAdmin));

// Admin protected routes
router.use(authorizeRoles('ADMIN'));

router.get('/me', getAdminMe);
router.get('/dashboard', getDashboardStats);
router.get('/dashboard/stats', getDashboardStats);

router.get('/users', getAllUsers);
router.delete('/users/:id', banUser);

router.get('/artists/applications', getArtistApplications);
router.get('/artists', getAllArtists);
router.get('/artists/bank-verifications', getBankVerificationArtists);
router.post('/artists', createArtist);
router.patch('/artists/:id', approveRejectArtist);
router.patch('/artists/:id/bank-verification', reviewArtistBankVerification);
router.delete('/artists/:id', deleteArtist);

router.get('/bookings', getAllBookings);
router.get('/bookings/:id', getBookingById);
router.patch('/bookings/:id/assign-artist', assignArtistToBooking);
router.patch('/bookings/:id/unassign-artist', unassignArtistFromBooking);

router.get('/reviews', getAllReviews);
router.delete('/reviews/:id', deleteReview);

router.get('/categories/all', getCategoriesForAdmin);
router.post('/categories', createCategory);
router.patch('/categories/:id/toggle', toggleCategory);
router.delete('/categories/:id', deleteCategory);

export default router;
