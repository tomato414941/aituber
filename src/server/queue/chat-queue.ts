export interface QueueItem {
  userName: string
  message: string
  timestamp: number
}

export class ChatQueue {
  private items: QueueItem[] = []
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  add(item: QueueItem): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift()
    }
    this.items.push(item)
  }

  dequeue(): QueueItem | undefined {
    return this.items.shift()
  }

  get length(): number {
    return this.items.length
  }

  clear(): void {
    this.items = []
  }
}
