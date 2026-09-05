// Claude marks file boundaries in its streamed output with these literal
// markers (see systemPrompt.ts for the exact instructions given to the
// model). Anything outside a file block is prose/chat text; anything inside
// is that file's content.
//
// <<<GENESIS_FILE path="src/App.vue">>>
// ...file content...
// <<<GENESIS_END_FILE>>>

export type ParserEvent =
  | { type: 'token'; data: string; path?: string }
  | { type: 'file_start'; path: string }
  | { type: 'file_end'; path: string }

const START_PREFIX = '<<<GENESIS_FILE path="'
const START_SUFFIX = '">>>\n'
const END_MARKER = '<<<GENESIS_END_FILE>>>'
const MAX_PENDING_PATH_CHARS = 500

// Longest suffix of `text` that is also a prefix of `marker` — used to decide
// how much of the buffer might be the start of a marker split across two
// stream chunks, so we don't emit it as content prematurely.
function overlapLength(text: string, marker: string): number {
  const max = Math.min(text.length, marker.length)
  for (let len = max; len > 0; len--) {
    if (text.endsWith(marker.slice(0, len))) return len
  }
  return 0
}

export class FileBoundaryParser {
  private buffer = ''
  private state: 'outside' | 'inside' = 'outside'
  private currentPath = ''

  push(chunk: string): ParserEvent[] {
    this.buffer += chunk
    const events: ParserEvent[] = []

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.state === 'outside') {
        const startIdx = this.buffer.indexOf(START_PREFIX)

        if (startIdx === -1) {
          const overlap = overlapLength(this.buffer, START_PREFIX)
          const safeLen = this.buffer.length - overlap
          if (safeLen > 0) {
            events.push({ type: 'token', data: this.buffer.slice(0, safeLen) })
          }
          this.buffer = this.buffer.slice(safeLen)
          break
        }

        const closeIdx = this.buffer.indexOf(START_SUFFIX, startIdx + START_PREFIX.length)
        if (closeIdx === -1) {
          if (this.buffer.length - startIdx > MAX_PENDING_PATH_CHARS) {
            // Doesn't look like a real marker after all — flush it as text.
            events.push({ type: 'token', data: this.buffer.slice(0, startIdx + START_PREFIX.length) })
            this.buffer = this.buffer.slice(startIdx + START_PREFIX.length)
            continue
          }
          if (startIdx > 0) {
            events.push({ type: 'token', data: this.buffer.slice(0, startIdx) })
          }
          this.buffer = this.buffer.slice(startIdx)
          break
        }

        if (startIdx > 0) {
          events.push({ type: 'token', data: this.buffer.slice(0, startIdx) })
        }
        this.currentPath = this.buffer.slice(startIdx + START_PREFIX.length, closeIdx)
        events.push({ type: 'file_start', path: this.currentPath })
        this.buffer = this.buffer.slice(closeIdx + START_SUFFIX.length)
        this.state = 'inside'
        continue
      }

      // state === 'inside'
      const endIdx = this.buffer.indexOf(END_MARKER)
      if (endIdx === -1) {
        const overlap = overlapLength(this.buffer, END_MARKER)
        const safeLen = this.buffer.length - overlap
        if (safeLen > 0) {
          events.push({ type: 'token', data: this.buffer.slice(0, safeLen), path: this.currentPath })
        }
        this.buffer = this.buffer.slice(safeLen)
        break
      }

      if (endIdx > 0) {
        events.push({ type: 'token', data: this.buffer.slice(0, endIdx), path: this.currentPath })
      }
      events.push({ type: 'file_end', path: this.currentPath })
      this.buffer = this.buffer.slice(endIdx + END_MARKER.length)
      this.state = 'outside'
      this.currentPath = ''
    }

    return events
  }

  // True if the stream ended mid-file (no proper end marker) — that file's
  // content is definitely incomplete. Check before flush(), which resets state.
  isInsideUnclosedFile(): string | null {
    return this.state === 'inside' ? this.currentPath : null
  }

  // Call once the stream ends. Flushes whatever's left in the buffer — if
  // we're still 'inside' a file, that file never got a proper end marker
  // (malformed output), so we close it out anyway rather than lose content.
  flush(): ParserEvent[] {
    const events: ParserEvent[] = []
    if (this.buffer.length > 0) {
      events.push(
        this.state === 'inside'
          ? { type: 'token', data: this.buffer, path: this.currentPath }
          : { type: 'token', data: this.buffer },
      )
    }
    if (this.state === 'inside') {
      events.push({ type: 'file_end', path: this.currentPath })
    }
    this.buffer = ''
    this.state = 'outside'
    this.currentPath = ''
    return events
  }
}
