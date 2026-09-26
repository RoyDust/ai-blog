import { ApiError } from '@/lib/api-errors'

/** Dependency failures must not turn generated-but-uncommitted work into a business failure. */
export class AiInfrastructureError extends Error {
  constructor(cause: unknown) {
    super('AI infrastructure operation failed', { cause })
    this.name = 'AiInfrastructureError'
  }
}

export async function withAiInfrastructure<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation() }
  catch (error) {
    if (error instanceof AiInfrastructureError || (error instanceof ApiError && error.status < 500)) throw error
    throw new AiInfrastructureError(error)
  }
}
