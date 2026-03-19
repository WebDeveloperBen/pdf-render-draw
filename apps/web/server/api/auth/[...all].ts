import { auth } from "@auth"

defineRouteMeta({
  openAPI: {
    tags: ["Auth"],
    summary: "Better Auth Handler",
    description: "Internal Better Auth catch-all route for authentication flows",
    responses: {
      200: { description: "Auth request handled" },
      400: { description: "Bad auth request" },
      401: { description: "Unauthorised" }
    }
  }
})

export default defineEventHandler(async (event) => auth.handler(toWebRequest(event)))
