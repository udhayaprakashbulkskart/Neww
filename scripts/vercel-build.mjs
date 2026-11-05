#!/usr/bin/env node
/**
 * Vercel build entry point. Runs migrations and bootstrap only when a database is configured for this
 * build (production), then builds the app. Preview builds without DIRECT_URL skip the database steps.
 */
import { execSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

run('prisma generate');
if (process.env.DIRECT_URL) {
  run('prisma migrate deploy');
  run('tsx prisma/bootstrap.ts');
} else {
  console.log('No DIRECT_URL for this build: skipping migrations and bootstrap.');
}
run('next build');
