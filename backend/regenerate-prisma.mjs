import { execSync } from 'child_process';
import path from 'path';

try {
  console.log('Regenerating Prisma client types...');
  execSync('npx prisma generate --schema ../database/schema/schema.prisma', {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });
  console.log('✓ Prisma types regenerated successfully!');
} catch (error) {
  console.error('✗ Failed to regenerate Prisma types:', error.message);
  process.exit(1);
}
