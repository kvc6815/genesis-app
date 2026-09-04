import { onRequest } from 'firebase-functions/v2/https'

const FAKE_FILE_PATH = 'demo.txt'
const WORD_DELAY_MS = 150

export const sseEcho = onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Content-Type', 'text/event-stream')
  res.set('Cache-Control', 'no-cache')
  res.set('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const message =
    typeof req.query.message === 'string' && req.query.message.trim()
      ? req.query.message.trim()
      : 'Hello from the Genesis SSE echo endpoint'
  const words = message.split(/\s+/)

  send({ type: 'file_start', path: FAKE_FILE_PATH })

  let i = 0
  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval)
      send({ type: 'file_end', path: FAKE_FILE_PATH })
      send({ type: 'complete' })
      res.end()
      return
    }
    send({ type: 'token', data: `${words[i]} ` })
    i++
  }, WORD_DELAY_MS)

  req.on('close', () => clearInterval(interval))
})
