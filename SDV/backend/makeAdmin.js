const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email: node makeAdmin.js <email>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }

    let role = await prisma.role.findUnique({ where: { name: 'Admin' } });
    if (!role) {
      role = await prisma.role.create({ data: { name: 'Admin' } });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' }
    });

    // Check if user already has this role
    const existingRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id
        }
      }
    });

    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      });
    }

    console.log(`User ${email} has been made an ACTIVE Admin.`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
