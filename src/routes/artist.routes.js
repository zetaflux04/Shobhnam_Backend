import { Router } from 'express';
import { approveRejectArtist, getArtistDetail, getMyArtistProfile, listArtists, updateArtistProfile, uploadAadharCard, uploadProfilePhoto } from '../controllers/artist.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../services/s3.service.js';
import { uploadWithErrorHandling } from '../utils/uploadUtils.js';

const router = Router();

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
