import type { EntityManager } from '@mikro-orm/postgresql'

/**
 * Local shim for @open-mercato/shared/lib/commands/flush#withAtomicFlush.
 * The guide documents this helper but the installed package version does not export it yet.
 *
 * Runs all steps sequentially, then flushes inside a transaction.
 * Steps capture `em` from their closure — the transaction is managed on the same EM instance.
 */
export async function withAtomicFlush(
  em: EntityManager,
  steps: Array<() => unknown>,
  _options?: { transaction?: boolean },
): Promise<void> {
  await em.begin()
  try {
    for (const step of steps) {
      await step()
    }
    await em.flush()
    await em.commit()
  } catch (error) {
    await em.rollback()
    throw error
  }
}
