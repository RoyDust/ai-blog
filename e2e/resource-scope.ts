/** Keeps the original assertion and all cleanup errors visible in the test report. */
export async function withResourceScope<T>(run: (defer: (cleanup: () => Promise<void>) => void) => Promise<T>): Promise<T> {
  const cleanup: Array<() => Promise<void>> = []
  const errors: unknown[] = []
  let result: T | undefined
  try { result = await run((operation) => cleanup.push(operation)) } catch (error) { errors.push(error) }
  for (const operation of cleanup.reverse()) { try { await operation() } catch (error) { errors.push(error) } }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'Test and/or fixture cleanup failed')
  return result as T
}
