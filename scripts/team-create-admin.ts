/**
 * Bootstrap the first team administrator from the command line (no portal session exists yet).
 *
 *   npm run team:create-admin -- --name "Asha Rao" --phone "+919812345678" --password "a-long-passphrase"
 *
 * Uses the same service code as the admin panel, so validation, hashing, group membership and
 * the audit entry are identical. Refuses to run without all three arguments.
 */
import { createMember } from '../src/lib/team/members';
import { db } from '../src/lib/db';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg('name');
  const phone = arg('phone');
  const password = arg('password');
  if (!name || !phone || !password) {
    console.error('Usage: npm run team:create-admin -- --name "Full Name" --phone "+91XXXXXXXXXX" --password "at-least-10-chars"');
    process.exit(1);
  }
  const result = await createMember(
    { id: 'bootstrap-cli', fullName: 'bootstrap', isAdmin: true },
    { fullName: name, phone, password, role: 'ADMIN', jobTitle: undefined, bio: undefined },
    'cli',
  );
  console.log(`Administrator created: ${result.id}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
