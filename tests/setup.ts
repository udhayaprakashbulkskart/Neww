// Test environment. Integration tests use a dedicated database that is never the development one.
(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/helptrust_test?schema=public';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.MOCK_PAYMENT_SECRET = 'test-mock-payment-secret';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.KYC_PROVIDER = 'mock';
process.env.SMS_PROVIDER = 'console';
process.env.EMAIL_PROVIDER = 'console';
process.env.STORAGE_DIR = './storage/test-private';
process.env.FRAUD_DONATIONS_PER_HOUR_PER_IP = '25';
