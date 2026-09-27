import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { startScheduler } from './server/scheduler'

// Custom server entry: starts the background scheduler once the server boots.
startScheduler()

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})
