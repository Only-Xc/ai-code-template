import { hash as argonHash } from '@node-rs/argon2'
import { PrismaClient } from 'generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { configuration } from 'src/config'

async function main() {
  const email = configuration('auth.initialAdminEmail')
  const password = configuration('auth.initialAdminPassword')
  const url = configuration('database.url')

  const pool = new Pool({ connectionString: url })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const hashedPassword = await argonHash(password)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        hashed_password: hashedPassword,
        is_active: true,
        is_superuser: true,
      },
    })
    console.log(`Updated superuser: ${email}`)
  } else {
    await prisma.user.create({
      data: { email, hashed_password: hashedPassword, is_superuser: true },
    })
    console.log(`Created superuser: ${email}`)
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
