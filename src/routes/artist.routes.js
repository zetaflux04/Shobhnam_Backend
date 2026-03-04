import { Router } from 'express';
import { approveRejectArtist, getArtistDetail, getMyArtistProfile, listArtists, updateArtistProfile } from '../controllers/artist.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';
import { uploadFields } from '../services/s3.service.js';

const router = Router();

// Publicly accessible routes (or generally accessible to any logged in user)
router.get('/', listArtists); // Paginated artist list with filters
router.get('/:id', getArtistDetail); // Detail view

// Admin routes
router.patch('/:id/approval', verifyJWT, authorizeRoles('ADMIN'), approveRejectArtist);

// Artist specific routes
router.use(verifyJWT);
router.use(authorizeRoles('ARTIST'));

router.route('/me')
  .get(getMyArtistProfile)
  .patch(uploadFields([{ name: 'profilePhoto', maxCount: 1 }, { name: 'aadharCard', maxCount: 1 }]), updateArtistProfile);

export default router;
