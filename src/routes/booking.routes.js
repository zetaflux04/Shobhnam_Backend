import { Router } from 'express';
import {
    completeBooking,
    createBooking,
    getAllBookingsAdmin,
    getArtistBookings,
    getUserBookings,
    respondToBooking
} from '../controllers/booking.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// User specific routes
router.post('/request', authorizeRoles('USER'), createBooking);
router.get('/user', authorizeRoles('USER'), getUserBookings);
router.patch('/:id/complete', authorizeRoles('USER', 'ARTIST'), completeBooking); // Either can complete

// Artist specific routes
router.patch('/:id/respond', authorizeRoles('ARTIST'), respondToBooking);
router.get('/artist', authorizeRoles('ARTIST'), getArtistBookings);

// Admin routes
router.get('/admin/all', authorizeRoles('ADMIN'), getAllBookingsAdmin);

export default router;
