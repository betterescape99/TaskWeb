import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/options"
import { TaskCreateSchema } from "@/lib/zod/task"
export const runtime = "nodejs"

function getUserId(session: any) {
  return (session?.user as any)?.id as string | undefined
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const json = await req.json()
  const parsed = TaskCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid body" },
      { status: 400 }
    )
  }

  const task = await prisma.task.create({
    data: { title: parsed.data.title, userId },
  })
  return NextResponse.json(task, { status: 201 })
}

// Clear done: DELETE /api/tasks?done=true
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  if (url.searchParams.get("done") !== "true") {
    return NextResponse.json({ error: "unsupported delete" }, { status: 400 })
  }

  await prisma.task.deleteMany({ where: { userId, done: true } })
  return NextResponse.json({ ok: true })
}
