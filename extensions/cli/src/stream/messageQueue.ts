import { EventEmitter } from "events";

export interface QueuedMessage {
  message: string;
  imageMap?: Map<string, Buffer>;
  timestamp: number;
}

/**
 * Simple in-memory queue that lets us defer user messages while a response is in flight.
 * Emits a "messageQueued" event whenever a message is queued so the UI can reflect it.
 */
class MessageQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];

  enqueueMessage(
    message: string,
    imageMap?: Map<string, Buffer>,
    inputHistory?: { addEntry?: (value: string) => void },
  ) {
    // Preserve history even for queued messages so navigation works as expected later.
    if (inputHistory?.addEntry) {
      try {
        inputHistory.addEntry(message);
      } catch {
        // Best-effort only; failure here shouldn't block queuing.
      }
    }

    const queued: QueuedMessage = {
      message,
      imageMap,
      timestamp: Date.now(),
    };

    this.queue.push(queued);
    this.emit("messageQueued", queued);
  }

  getLatestMessage(): QueuedMessage | null {
    if (this.queue.length === 0) return null;

    const latest = this.queue[this.queue.length - 1];
    this.queue = [];
    return latest;
  }
}

export const messageQueue = new MessageQueue();
