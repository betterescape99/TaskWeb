// lib/prisma.ts — supports both local SQLite (file:) and remote Turso (libsql://)
import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { resolve } from "path"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  let url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  // Resolve relative file: paths to absolute.
  // Prisma CLI resolves file:./xxx relative to the schema dir (prisma/).
  // We mirror that here so both CLI and runtime read the same file.
  if (url.startsWith("file:") && !url.startsWith("file:/")) {
    const relPath = url.slice(5) // strip "file:"
    url = `file:${resolve("prisma", relPath)}`
  }

  const config: { url: string; authToken?: string } = { url }
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (authToken) config.authToken = authToken

  const adapter = new PrismaLibSql(config)

  return new PrismaClient({ adapter, log: ["error"] })
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma
