export default class OutboxDispatcher {
  async dispatchPending() {
    return { success: true, dispatched: 0 }
  }
}

