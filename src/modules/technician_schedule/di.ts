import { asClass, asFunction } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createOverlapCheck } from './lib/overlapCheck'

class ReservationService {
  constructor(
    public readonly em: EntityManager,
    public readonly overlapCheck: ReturnType<typeof createOverlapCheck>,
  ) {}
}

export function register(container: AppContainer): void {
  container.register({
    overlapCheck: asFunction(({ em }: { em: EntityManager }) => createOverlapCheck({ em })).scoped(),
    reservationService: asClass(ReservationService).scoped(),
  })
}
