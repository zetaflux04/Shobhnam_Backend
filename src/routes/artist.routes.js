import { Router } from 'express';
import { approveRejectArtist, getArtistDetail, getMyArtistProfile, listArtists, updateArtistProfile, uploadAadharCard, uploadProfilePhoto } from '../controllers/artist.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../services/s3.service.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

/** Wraps multer upload middleware to catch S3/multer errors, log them, and return a structured 500 */
const uploadWithErrorHandling = (uploadMiddleware, controller) => [
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        console.error('[Upload] Multer/S3 error:', err?.message || err, err?.stack);
        next(new ApiError(500, 'File upload failed. Please try again.'));
      } else {
        next();
      }
    });
  },
  controller,
];

// Publicly accessible routes
router.get('/', listArtists); // Paginated artist list with filters

// Artist /me routes - MUST be defined before /:id so /me is not captured as id
const artistAuth = [verifyJWT, authorizeRoles('ARTIST')];
router.get('/me', ...artistAuth, getMyArtistProfile);
router.patch('/me', ...artistAuth, updateArtistProfile);
router.post('/me/upload-profile-photo', ...artistAuth, ...uploadWithErrorHandling(uploadSingle('profilePhoto'), uploadProfilePhoto));
router.post('/me/upload-aadhar', ...artistAuth, ...uploadWithErrorHandling(uploadSingle('aadharCard'), uploadAadharCard));

// Public - must be after /me
router.get('/:id', getArtistDetail); // Detail view

// Admin routes
router.patch('/:id/approval', verifyJWT, authorizeRoles('ADMIN'), approveRejectArtist);

export default router;
