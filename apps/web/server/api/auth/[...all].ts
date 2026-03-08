import { auth } from "@auth"

export default defineEventHandler(async (event) => auth.handler(toWebRequest(event)))
