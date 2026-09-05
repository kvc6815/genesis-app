import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import Anthropic from '@anthropic-ai/sdk'
import '../admin'
import { FileBoundaryParser } from './fileBoundaryParser'
import { buildSystemPrompt } from './systemPrompt'
import { getProjectFiles } from '../projects/getProjectFiles'
import { persistGeneratedFiles } from '../projects/persistGeneratedFiles'
import { createSnapshot } from '../projects/createSnapshot'

const MODEL = 'claude-sonnet-5'

// Cloud Run's default HTTP timeout (60s) is too short for a multi-file
// generation — hitting it force-closes the connection mid-stream, which
// looks exactly like a client network drop (`req.on('close')` fires either
// way) but is actually the platform cutting the request off. This happened
// for real: a 3-file generation was truncated mid-statement in app.js with
// no max_tokens warning, because the cutoff was the timeout, not the model.
export const generateStream = onRequest({ timeoutSeconds: 300 }, async (req, res) => {
  // EventSource can only do GET with no custom headers, so auth travels as a
  // query param. Reject before any SSE headers go out, so failures are plain
  // HTTP error responses rather than SSE error events.
  const idToken = req.query.idToken
  const projectId = req.query.projectId
  const message = typeof req.query.message === 'string' ? req.query.message.trim() : ''

  if (typeof idToken !== 'string' || typeof projectId !== 'string' || !message) {
    res.status(400).json({ error: 'pass ?idToken=&projectId=&message=' })
    return
  }

  let uid: string
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid
  } catch {
    res.status(401).json({ error: 'invalid idToken' })
    return
  }

  const projectDoc = await getFirestore().doc(`projects/${projectId}`).get()
  const project = projectDoc.data()
  if (!projectDoc.exists || project?.ownerId !== uid) {
    res.status(403).json({ error: 'not your project' })
    return
  }

  const existingFiles = await getProjectFiles(projectId)

  res.set('Access-Control-Allow-Origin', '*')
  res.set('Content-Type', 'text/event-stream')
  res.set('Cache-Control', 'no-cache')
  res.set('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const system = buildSystemPrompt({
    projectName: (project?.name as string) ?? 'Untitled',
    projectDescription: (project?.description as string) ?? '',
    existingFiles,
  })
  const parser = new FileBoundaryParser()
  const generatedFiles = new Map<string, string>()
  let stopReason: string | null = null

  const appendToFile = (path: string, data: string) => {
    generatedFiles.set(path, (generatedFiles.get(path) ?? '') + data)
  }

  const finishGeneration = async (status: 'complete' | 'error', errorMessage?: string) => {
    logger.info(`generateStream: finishing with status=${status} for project=${projectId}, ${generatedFiles.size} file(s)`)
    try {
      await persistGeneratedFiles(projectId, generatedFiles)
      if (status === 'complete' && generatedFiles.size > 0) {
        await createSnapshot(projectId)
      }
      send(status === 'complete' ? { type: 'complete' } : { type: 'error', message: errorMessage })
    } catch (err) {
      logger.warn(`generateStream: failed to persist for project=${projectId}: ${err instanceof Error ? err.message : String(err)}`)
      send({ type: 'error', message: 'failed to save generated files' })
    }
    res.end()
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 16384,
    system,
    messages: [{ role: 'user', content: message }],
  })

  req.on('close', () => stream.abort())

  stream.on('text', (text) => {
    for (const event of parser.push(text)) {
      if (event.type === 'token' && event.path) appendToFile(event.path, event.data)
      send(event)
    }
  })

  // The Anthropic SDK treats hitting max_tokens as a normal stream
  // completion (not an 'error') — without checking stop_reason, a response
  // cut off mid-file would silently persist as if it succeeded, corrupting
  // the file (this happened for real: a truncated <script> tag broke the
  // preview with no error surfaced anywhere).
  stream.on('finalMessage', (finalMsg) => {
    stopReason = finalMsg.stop_reason
  })

  stream.on('end', () => {
    const unclosedPath = parser.isInsideUnclosedFile()
    for (const event of parser.flush()) {
      if (event.type === 'token' && event.path) appendToFile(event.path, event.data)
      send(event)
    }
    if (stopReason === 'max_tokens') {
      // That file's content is definitely incomplete — drop it rather than
      // overwrite a previously-working version with a broken one. Any other
      // files that finished cleanly before the cutoff are still kept.
      if (unclosedPath) generatedFiles.delete(unclosedPath)
      logger.warn(
        `generateStream: response truncated (max_tokens) for project=${projectId}, dropped incomplete file=${unclosedPath}`,
      )
      void finishGeneration('error', 'Response was cut off (too long) — try asking for a smaller change.')
    } else {
      void finishGeneration('complete')
    }
  })

  stream.on('error', (err) => {
    logger.warn(`Claude stream error for project=${projectId}: ${err instanceof Error ? err.message : String(err)}`)
    for (const event of parser.flush()) {
      if (event.type === 'token' && event.path) appendToFile(event.path, event.data)
    }
    void finishGeneration('error', 'generation failed')
  })

  // Fires when stream.abort() runs (client disconnected, see req.on('close')
  // above). The client is already gone, so there's no one to send SSE events
  // to — but per SPEC.md, an interrupted stream must still preserve partial
  // results, so persist whatever files completed before the abort.
  stream.on('abort', () => {
    logger.info(
      `generateStream: client disconnected mid-generation for project=${projectId}, persisting ${generatedFiles.size} partial file(s)`,
    )
    for (const event of parser.flush()) {
      if (event.type === 'token' && event.path) appendToFile(event.path, event.data)
    }
    persistGeneratedFiles(projectId, generatedFiles).catch((err) => {
      logger.warn(
        `generateStream: failed to persist partial files after abort for project=${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
  })
})
