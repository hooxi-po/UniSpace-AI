import { basename, dirname, join } from 'node:path'
import { rename, unlink, writeFile } from 'node:fs/promises'

const lockQueue = new Map<string, Promise<unknown>>()

export function withFileLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = lockQueue.get(filePath) ?? Promise.resolve()
  const nextTask = previous.catch(() => undefined).then(task)
  lockQueue.set(filePath, nextTask.catch(() => undefined))
  return nextTask
}

export async function writeJsonAtomic(filePath: string, value: unknown) {
  const tempFile = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  )
  const content = JSON.stringify(value, null, 2)

  try {
    await writeFile(tempFile, content, 'utf-8')
    await rename(tempFile, filePath)
  } catch (error) {
    await unlink(tempFile).catch(() => undefined)
    throw error
  }
}
