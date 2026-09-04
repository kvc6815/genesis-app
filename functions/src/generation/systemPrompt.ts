export interface ExistingFile {
  path: string
  content: string
}

export interface SystemPromptContext {
  projectName: string
  projectDescription: string
  existingFiles: ExistingFile[]
}

const HL_CAPABILITIES = `
You have access to the following HighLevel data through proxied endpoints on this app's own
backend — NEVER call services.leadconnectorhq.com or any HighLevel domain directly, and never
expect a HighLevel access token to be available in the browser. Call these with a plain
fetch() to a relative path:

- GET  /api/hl/contacts?query=<text>&pageLimit=<n>        -> { contacts: [...], total }
- GET  /api/hl/contacts/:id                                -> { contact: {...} }
- GET  /api/hl/conversations?limit=<n>                     -> { conversations: [...], total }
- GET  /api/hl/conversations/:id/messages?limit=<n>        -> { messages: { messages: [...] } }
- GET  /api/hl/calendars                                   -> { calendars: [...] }
- GET  /api/hl/calendars/events?calendarId=<id>&startTime=<ms>&endTime=<ms>
                                                            -> { events: [...] }

All of these return real data from the connected HighLevel location. Build UI around whatever
shape comes back; don't invent fields that aren't in the response shapes above.
`.trim()

const FILE_FORMAT_INSTRUCTIONS = `
Whenever you write or modify a file, wrap its full contents EXACTLY like this, with nothing
else on the marker lines:

<<<GENESIS_FILE path="relative/path/to/file.ext">>>
...the complete file content...
<<<GENESIS_END_FILE>>>

Rules:
- Always emit the FULL content of a file, never a diff or "...rest unchanged".
- Use one block per file. Emit as many blocks as you need.
- Anything outside these blocks is shown to the user as chat text — keep it brief (what you
  built and why), not a restatement of the code.
- Do not wrap the blocks in markdown code fences (no triple-backticks around them).
`.trim()

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const filesSection =
    ctx.existingFiles.length === 0
      ? 'This project has no files yet — you are creating it from scratch.'
      : [
          'Existing project files (modify these in place if the request calls for it; leave',
          'unrelated files alone by simply not re-emitting them):',
          '',
          ...ctx.existingFiles.map((f) => `--- ${f.path} ---\n${f.content}`),
        ].join('\n')

  return [
    `You are generating code for a web app project called "${ctx.projectName}".`,
    `Project description: ${ctx.projectDescription || '(none given)'}`,
    '',
    filesSection,
    '',
    HL_CAPABILITIES,
    '',
    FILE_FORMAT_INSTRUCTIONS,
  ].join('\n')
}
