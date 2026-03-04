import { env } from '../config/env.js';
import { User } from '../models/user.model.js';

/**
 * Seeds the admin user into DB if they don't already exist.
 * Uses ADMIN_EMAIL and ADMIN_PASSWORD from .env
 */
export const seedAdmin = async () => {
  try {
    const existing = await User.findOne({ email: env.ADMIN_EMAIL, role: 'ADMIN' });
    if (existing) {
      console.log(`✅ Admin user already exists: ${env.ADMIN_EMAIL}`);
      return;
    }

    await User.create({
      name: 'Shobhnam Admin',
      email: env.ADMIN_EMAIL,
      phone: '0000000000',
      password: env.ADMIN_PASSWORD,
      role: 'ADMIN',
    });

    console.log(`✅ Admin user seeded: ${env.ADMIN_EMAIL}`);
  } catch (error) {
    if (error.code === 11000) {
      console.log('ℹ️  Admin user already exists in DB');
      return;
    }
    console.error('⚠️  Admin seeding failed:', error.message);
  }
};
