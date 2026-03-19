defineRouteMeta({
  openAPI: {
    tags: ["Dev"],
    summary: "List Email Previews",
    description: "List development-only email preview templates",
    responses: {
      200: {
        description: "HTML email preview index",
        content: {
          "text/html": {
            schema: {
              type: "string"
            }
          }
        }
      },
      404: { description: "Not found in production" }
    }
  }
})

export default defineEventHandler((event) => {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404, message: "Not found" })
  }

  const templates = ["password-reset", "verification", "magic-link", "organization-invite"]

  const templateList = templates.map((t) => `<li><a href="/api/_dev/emails/${t}">${t}</a></li>`).join("")

  setHeader(event, "Content-Type", "text/html")

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Email Templates Preview</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
          h1 { color: #f97316; }
          ul { list-style: none; padding: 0; }
          li { margin: 12px 0; }
          a { color: #3b82f6; text-decoration: none; font-size: 18px; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Email Templates</h1>
        <p>Click a template to preview:</p>
        <ul>${templateList}</ul>
      </body>
    </html>
  `
})
