import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DATABASE_ADMIN_EMAIL!;
  const rawPass = process.env.DATABASE_ADMIN_PASSWORD!;
  const name = process.env.DATABASE_ADMIN_NAME || 'Admin';
  const lastname = process.env.DATABASE_ADMIN_LASTNAME || 'User';

  const hashRounds = process.env.HASH_ROUNDS
    ? parseInt(process.env.HASH_ROUNDS)
    : 10;

  if (!email || !rawPass) {
    throw new Error('Faltan ADMIN_EMAIL o ADMIN_PASSWORD en .env');
  }

  const password = await bcrypt.hash(rawPass, hashRounds);

  // creates if not exists, otherwise updates to ensure admin role
  await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.ADMIN, // asegurar rol admin
      password,
      name,
      lastname,
    },
    create: {
      email,
      password,
      name,
      lastname,
      role: Role.ADMIN,
      emailVerified: true, // marcar email como verificado
    },
  });

  console.log('✅ Admin asegurado:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
