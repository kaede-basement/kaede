//
// ATTENTION: AI-generated (by Claude Opus 5.5)
//
// Replacement for Tauri's ipc-protocol.js, installed with tauri::Builder::invoke_system.
// Small JSON calls go through window.ipc.postMessage; binary payloads, large JSON payloads and
// channel data fetches keep the custom protocol. Small JSON calls made in the same tick travel as
// one message to the `ipc_batch` app command (ipc_batch.rs), which must be in the app's invoke
// handler with `ipc_batch_take`. Like Tauri's own script, it falls back to postMessage once the
// custom protocol fails.
;(function () {
  const invokeKey = __INVOKE_KEY__
  const BATCH_COMMAND = 'ipc_batch'
  const TAKE_COMMAND = 'ipc_batch_take'
  const FETCH_CHANNEL_DATA_COMMAND = 'plugin:__TAURI_CHANNEL__|fetch'
  const SERIALIZE_TO_IPC_FN = '__TAURI_TO_IPC_KEY__'
  // On WebView2 a JSON payload this large travels faster through fetch than through postMessage,
  // and inside a batch it would hold back the other calls' responses: the batch runs as one task.
  const MAX_POST_MESSAGE_PAYLOAD_CHARS = 64 * 1024
  const internals = window.__TAURI_INTERNALS__
  // Names this page load for ipc_batch, which queues the responses per page and delivers them only
  // to the document that asked: after a navigation the webview holds another document.
  const page = Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-')
  Object.defineProperty(internals, 'ipcPage', { value: page })
  let customProtocolFailed = false
  // WebView2 hands Rust the postMessage of the top document only, and ipc_batch tracks one page per
  // webview: a frame keeps Tauri's own transport.
  const topFrame = window === window.top

  // Same classification as Tauri's process-ipc-message-fn.js.
  function isRaw(payload) {
    return payload instanceof ArrayBuffer || ArrayBuffer.isView(payload) || Array.isArray(payload)
  }

  function toJson(value) {
    return JSON.stringify(value, (_k, val) => {
      if (val instanceof Map) return Object.fromEntries(val.entries())
      if (val instanceof Uint8Array) return Array.from(val)
      if (val instanceof ArrayBuffer) return Array.from(new Uint8Array(val))
      if (typeof val === 'object' && val !== null && SERIALIZE_TO_IPC_FN in val) return val[SERIALIZE_TO_IPC_FN]()
      return val
    })
  }

  // The bytes the custom protocol would send for a binary payload; fetch turns an array body into
  // its string.
  function bytesOf(payload) {
    if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
    if (ArrayBuffer.isView(payload)) return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
    return new TextEncoder().encode(String(payload))
  }

  // The headers a command sees on the custom protocol: the caller's, with the transport's own set
  // over them.
  function transportHeaders({ callback, error, headers: own }, bin) {
    const headers = new Headers(own || undefined)
    headers.set('Content-Type', bin ? 'application/octet-stream' : 'application/json')
    headers.set('Tauri-Callback', callback)
    headers.set('Tauri-Error', error)
    headers.set('Tauri-Invoke-Key', invokeKey)
    return headers
  }

  // Everything that can throw in the page happens here, synchronously, so a bad payload or header
  // rejects that call alone, and every string the batch carries is one Rust can parse. A binary
  // payload reaches this only after the custom protocol failed.
  function prepare(message) {
    // The custom protocol puts the command in a URL, which a lone surrogate cannot be.
    encodeURIComponent(message.cmd)
    const bin = isRaw(message.payload)
    // ipc_batch sets the transport's own headers over these, as transportHeaders does for fetch.
    // A Request's headers drop what a fetch would not send (Cookie, Referer, Sec-*...); Tauri's
    // postMessage fallback passes every header on.
    const own = message.headers
    const headers = !own
      ? {}
      : Object.fromEntries(customProtocolFailed ? own : new Request(internals.convertFileSrc(message.cmd, 'ipc'), { method: 'POST', headers: own }).headers)
    // A payload that serializes to nothing (a function, toJSON returning undefined) is an empty
    // fetch body, which Tauri reads as {}.
    const json = bin ? toJson(Array.from(bytesOf(message.payload))) : message.json
    return { message, headers, bin, payload: json === undefined ? '{}' : json }
  }

  // `head` is a serialized object; the payload is spliced in as already serialized JSON.
  function withPayload(head, payload) {
    return `${toJson(head).slice(0, -1)},"payload":${payload}}`
  }

  function postSingle({ message: { cmd, callback, error }, headers, payload }) {
    const options = { headers, customProtocolIpcBlocked: customProtocolFailed }
    window.ipc.postMessage(withPayload({ cmd, callback, error, options, __TAURI_INVOKE_KEY__: invokeKey }, payload))
  }

  // Commands sent over fetch that have not settled. While there is one, later calls take fetch too,
  // so they reach Rust in the order they were made, as on Tauri's own transport: a batch sent
  // through postMessage would overtake them.
  let fetchesInFlight = 0

  // `ordered`: false for a fetch that only collects data for an earlier call (a large response, a
  // Channel's messages), whose order against other commands does not matter.
  function sendOverFetch(message, ordered = true) {
    const { cmd, callback, error, payload, json } = message
    const raw = isRaw(payload)
    const request = fetch(internals.convertFileSrc(cmd, 'ipc'), {
      method: 'POST',
      body: raw ? payload : json,
      headers: transportHeaders(message, raw)
    })
    if (ordered) fetchesInFlight++
    const settle = () => {
      if (ordered) fetchesInFlight--
    }
    request
      .then((response) => {
        const id = response.headers.get('Tauri-Response') === 'ok' ? callback : error
        switch ((response.headers.get('content-type') || '').split(',')[0]) {
          case 'application/json':
            return response.json().then((r) => [id, r])
          case 'text/plain':
            return response.text().then((r) => [id, r])
          default:
            return response.arrayBuffer().then((r) => [id, r])
        }
      })
      .then(
        ([id, data]) => {
          settle()
          internals.runCallback(id, data)
        },
        (e) => {
          settle()
          console.warn('IPC custom protocol failed, Tauri will now use the postMessage interface instead', e)
          customProtocolFailed = true
          try {
            sendOverPostMessage(prepare(message))
          } catch (e2) {
            internals.runCallback(error, e2)
          }
        }
      )
  }

  let queue = []
  let queuedChars = 0

  // Even a lone call goes through the batch command: Tauri's own postMessage responder evaluates
  // small JSON as a JavaScript literal, where a "__proto__" key sets the prototype instead of
  // staying an own property as it does with response.json() on the custom protocol.
  function enqueue(item) {
    if (queuedChars + item.payload.length > MAX_POST_MESSAGE_PAYLOAD_CHARS) sendQueued()
    if (queue.push(item) === 1) queueMicrotask(sendQueued)
    queuedChars += item.payload.length
    if (queuedChars >= MAX_POST_MESSAGE_PAYLOAD_CHARS) sendQueued()
  }

  function sendQueued() {
    const items = queue
    queue = []
    queuedChars = 0
    if (items.length === 0) return
    const registered = []
    try {
      postBatch(items, registered)
    } catch (e) {
      for (const id of registered) internals.unregisterCallback(id)
      for (const { message } of items) internals.runCallback(message.error, e)
    }
  }

  // `registered` collects the callbacks it registers, for the caller to drop if it throws.
  function postBatch(items, registered) {
    const calls = items.map(({ message: { cmd, callback, error }, headers, bin, payload }) =>
      toJson({ cmd, callback, error, headers, bin, payload })
    )
    const ok = internals.transformCallback(() => internals.unregisterCallback(failed), true)
    const failed = internals.transformCallback((e) => {
      internals.unregisterCallback(ok)
      for (const { message } of items) internals.runCallback(message.error, e)
    }, true)
    registered.push(ok, failed)
    const options = { headers: {}, customProtocolIpcBlocked: customProtocolFailed }
    window.ipc.postMessage(
      withPayload(
        { cmd: BATCH_COMMAND, callback: ok, error: failed, options, __TAURI_INVOKE_KEY__: invokeKey },
        `{"page":"${page}","blocked":${customProtocolFailed},"calls":[${calls.join(',')}]}`
      )
    )
  }

  function sendOverPostMessage(item) {
    if (topFrame) enqueue(item)
    else postSingle(item)
  }

  Object.defineProperty(internals, 'ipcBatchDeliver', {
    value: (responses) => {
      for (const [callback, value, kind] of responses) {
        if (kind === 0) internals.runCallback(callback, value)
        else if (kind === 1) internals.runCallback(callback, new Uint8Array(value).buffer)
        else {
          // Too large for eval: taken over the custom protocol, so it arrives as a fetch response.
          const [ok, error] = callback
          const payload = { page, id: value }
          sendOverFetch({ cmd: TAKE_COMMAND, callback: ok, error, payload, json: toJson(payload), headers: null }, false)
        }
      }
    }
  })

  // The payload is serialized and the caller's headers are read once, in this order as Tauri's
  // ipc-protocol.js does, and every route takes them from here: an iterable can be read only once,
  // and a Headers combines repeated names the way a fetch sees them.
  function send({ cmd, callback, error, payload, options }) {
    const json = isRaw(payload) ? undefined : toJson(payload)
    const own = options && options.headers
    const message = { cmd, callback, error, payload, json, headers: own ? new Headers(own) : null }
    const channelData = cmd === FETCH_CHANNEL_DATA_COMMAND
    const overFetch = channelData || isRaw(payload) || !topFrame || fetchesInFlight > 0
    if (overFetch && !customProtocolFailed) {
      sendQueued()
      return sendOverFetch(message, !channelData)
    }
    const item = prepare(message)
    if (item.payload.length >= MAX_POST_MESSAGE_PAYLOAD_CHARS && !customProtocolFailed) {
      sendQueued()
      return sendOverFetch(message)
    }
    sendOverPostMessage(item)
  }

  // An empty batch tells ipc_batch this page replaced the webview's previous one, whose large
  // responses nobody will take now. Tauri runs invoke_system's script as an init script of its own
  // before the one with core.js, which defines transformCallback: a task runs after both.
  if (topFrame) {
    setTimeout(() => {
      const registered = []
      try {
        postBatch([], registered)
      } catch (e) {
        for (const id of registered) internals.unregisterCallback(id)
        console.warn('ipc_batch: cannot announce the page', e)
      }
    }, 0)
  }

  Object.defineProperty(internals, 'postMessage', {
    value: (message) => {
      try {
        send(message)
      } catch (e) {
        // Rejecting through the call's own error callback also unregisters both of its callbacks,
        // which a throw out of invoke's Promise executor would leave behind.
        internals.runCallback(message.error, e)
      }
    }
  })
})()
