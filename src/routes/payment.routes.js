import { Router } from 'express';
import { createRazorpayOrder, razorpayWebhook, verifyPayment } from '../controllers/payment.controller.js';
import { authorizeRoles, verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Webhook doesn't require JWT, Razorpay Server calls it directly
router.post('/webhook', razorpayWebhook);

// Protected routes
router.use(verifyJWT);
router.post('/create-order', authorizeRoles('USER'), createRazorpayOrder);
router.post('/verify', authorizeRoles('USER'), verifyPayment);

export default router;
