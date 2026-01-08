import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json()
  const email = String(body?.email ?? "").trim().toLowerCase()
  const password = String(body?.password ?? "")
  const name = String(body?.name ?? "").trim() || null

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "password must be at least 6 chars" }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return NextResponse.json({ error: "email already used" }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
    select: { id: true, email: true, name: true },
  })

  return NextResponse.json(user, { status: 201 })
}
