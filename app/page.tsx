import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "./api/auth/[...nextauth]/options"
import BoardClient from "./board-client"

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/login")
  return <BoardClient />
}
