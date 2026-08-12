import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  const platformSecret = process.env.PLATFORM_JWT_SECRET;
  if (!platformSecret) {
    throw new Error('PLATFORM_JWT_SECRET environment variable is required');
  }
  return {
    secret,
    platformSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    // Opaque refresh-token lifetime in days (mobile clients). Default 30d.
    refreshExpiresInDays: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 30,
  };
});
