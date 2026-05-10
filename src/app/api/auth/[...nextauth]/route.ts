import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { withApiOperationLogging } from "@/lib/api-operation-log-route"

const handler = NextAuth(authOptions)
const loggedHandler = withApiOperationLogging(handler, {
  scope: "auth",
  operation: "auth.nextauth",
  route: "/api/auth/[...nextauth]",
  captureRequestBody: false,
})

export { loggedHandler as GET, loggedHandler as POST }
