import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/options"
import { TaskPatchSchema } from "@/lib/zod/task"
export const runtime = "nodejs"

function getUserId(session: any) {
  return (session?.user as any)?.id as string | undefined
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await ctx.params

  const json = await req.json()
  const parsed = TaskPatchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid body" },
      { status: 400 }
    )
  }

  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: parsed.data, // 已经是干净的 {title?, done?}
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const task = await prisma.task.findFirst({ where: { id, userId } })
  return NextResponse.json(task)
}


export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await ctx.params

  const result = await prisma.task.deleteMany({
    where: { id, userId },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
