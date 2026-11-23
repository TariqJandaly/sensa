/**
 * One-off: delete the E2E probe user (and its cascaded rows).
 * Usage: bun --env-file=.env.local run scripts/cleanup-probe.ts <email>
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const email = process.argv[2]
if (!email) {
  console.error('usage: cleanup-probe.ts <email>')
  process.exit(1)
}

const user = await prisma.user.findUnique({ where: { email } })
if (user) {
  await prisma.user.delete({ where: { id: user.id } })
  console.log('probe user deleted:', email)
} else {
  console.log('probe user already gone:', email)
}
await prisma.$disconnect()
