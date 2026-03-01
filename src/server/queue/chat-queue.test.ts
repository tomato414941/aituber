import { describe, it, expect } from 'vitest'
import { ChatQueue } from './chat-queue.js'

describe('ChatQueue', () => {
  it('enqueues and dequeues items in FIFO order', () => {
    const q = new ChatQueue()
    q.add({ userName: 'a', message: 'hello', timestamp: 1 })
    q.add({ userName: 'b', message: 'world', timestamp: 2 })

    expect(q.length).toBe(2)
    expect(q.dequeue()).toEqual({ userName: 'a', message: 'hello', timestamp: 1 })
    expect(q.dequeue()).toEqual({ userName: 'b', message: 'world', timestamp: 2 })
    expect(q.dequeue()).toBeUndefined()
  })

  it('drops oldest item when maxSize is reached', () => {
    const q = new ChatQueue(2)
    q.add({ userName: 'a', message: '1', timestamp: 1 })
    q.add({ userName: 'b', message: '2', timestamp: 2 })
    q.add({ userName: 'c', message: '3', timestamp: 3 })

    expect(q.length).toBe(2)
    expect(q.dequeue()?.userName).toBe('b')
    expect(q.dequeue()?.userName).toBe('c')
  })

  it('clears the queue', () => {
    const q = new ChatQueue()
    q.add({ userName: 'a', message: 'x', timestamp: 1 })
    q.clear()
    expect(q.length).toBe(0)
    expect(q.dequeue()).toBeUndefined()
  })
})
