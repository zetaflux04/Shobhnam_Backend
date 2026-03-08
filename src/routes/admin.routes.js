import { Router } from 'express';
import {
  approveRejectArtist,
  banUser,
  createCategory,
  deleteArtist,
  deleteCategory,
  deleteReview,
  getAdminMe,
  getAllArtists,
  getArtistApplications,
  getAllBookings,
  getAllReviews,
  getAllUsers,
  getBookingById,
  getCategories,
  getCategoriesForAdmin,
  getDashboardStats,
  toggleCategory,
} from '../controllers/admin.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Publicly readable categories
router.get('/categories', getCategories);

// Admin protected routes
router.use(verifyJWT);
router.use(authorizeRoles('ADMIN'));

router.get('/me', getAdminMe);
router.get('/dashboard', getDashboardStats);
router.get('/dashboard/stats', getDashboardStats);

router.get('/users', getAllUsers);
router.delete('/users/:id', banUser);

router.get('/artists/applications', getArtistApplications);
router.get('/artists', getAllArtists);
router.patch('/artists/:id', approveRejectArtist);
router.delete('/artists/:id', deleteArtist);

router.get('/bookings', getAllBookings);
router.get('/bookings/:id', getBookingById);

router.get('/reviews', getAllReviews);
router.delete('/reviews/:id', deleteReview);

router.get('/categories/all', getCategoriesForAdmin);
router.post('/categories', createCategory);
router.patch('/categories/:id/toggle', toggleCategory);
router.delete('/categories/:id', deleteCategory);

export default router;
