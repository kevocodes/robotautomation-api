import { registerAs } from '@nestjs/config';

export default registerAs('env', () => ({
  rateLimit: {
    default: {
      ttl: parseInt(process.env.RATE_LIMIT_DEFAULT_TTL, 10),
      limit: parseInt(process.env.RATE_LIMIT_DEFAULT_LIMIT, 10),
    },
    email: {
      ttl: parseInt(process.env.RATE_LIMIT_EMAIL_TTL, 10),
      limit: parseInt(process.env.RATE_LIMIT_EMAIL_LIMIT, 10),
    },
  },
  port: parseInt(process.env.PORT, 10),
  database: {
    url: process.env.DATABASE_URL,
    adminEmail: process.env.DATABASE_ADMIN_EMAIL,
    adminPassword: process.env.DATABASE_ADMIN_PASSWORD,
    adminName: process.env.DATABASE_ADMIN_NAME,
    adminLastname: process.env.DATABASE_ADMIN_LASTNAME,
  },
  hash: {
    rounds: parseInt(process.env.HASH_ROUNDS, 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    defaults: {
      from: process.env.SMTP_DEFAULT_FROM,
    },
    contactUsEmail: process.env.SMTP_CONTACT_US_EMAIL,
  },
  cloudinary: {
    name: process.env.CLOUDINARY_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER,
  },
  OTP: {
    expiresIn: parseInt(process.env.OTPS_EXPIRES_IN, 10),
  },
  forgotPassword: {
    page: process.env.FORGOT_PASSWORD_PAGE,
    expiresIn: parseInt(process.env.FORGOT_PASSWORD_TOKEN_EXPIRES_IN, 10),
  },
  deiBooking: {
    apiUrl: process.env.DEI_API_URL,
    authPath: process.env.DEI_AUTH_PATH,
    username: process.env.DEI_USERNAME,
    password: process.env.DEI_PASSWORD,
    identifier: process.env.DEI_IDENTIFIER,
    tokenExpiration: parseInt(process.env.DEI_TOKEN_EXPIRATION, 10),
  },
}));
