import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const barbarian = await prisma.class.findUnique({
    where: { name: 'Barbarian' },
    select: { id: true },
  });

  if (!barbarian) {
    console.log('');
    return;
  }

  const choice = await prisma.choice.findFirst({
    where: {
      sourceType: 'class',
      sourceId: barbarian.id,
    },
    select: { id: true },
  });

  if (!choice) {
    console.log('');
    return;
  }

  console.log(choice.id);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
