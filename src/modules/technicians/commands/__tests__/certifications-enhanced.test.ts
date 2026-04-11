/** @jest-environment node */
import { addCertificationCommand, updateCertificationCommand } from '../certifications'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const CERT_UUID = '33333333-3333-4333-8333-333333333333'

function createCtx(overrides?: { findOne?: any; createOrmEntity?: any; updateOrmEntity?: any }) {
  const em = {
    findOne: overrides?.findOne ?? jest.fn().mockResolvedValue({ id: VALID_UUID, tenantId: 't1', organizationId: 'o1', deletedAt: null }),
  }
  const de = {
    createOrmEntity: overrides?.createOrmEntity ?? jest.fn().mockResolvedValue({
      id: CERT_UUID,
      name: 'ISO 9001',
      certType: 'quality',
      code: 'ISO-001',
      issuedBy: 'TUV',
      notes: 'Annual',
    }),
    updateOrmEntity: overrides?.updateOrmEntity ?? jest.fn().mockResolvedValue({
      id: CERT_UUID,
      name: 'ISO 9001',
      notes: 'Renewed',
    }),
  }
  return {
    container: {
      resolve: jest.fn((key: string) => {
        if (key === 'em') return em
        if (key === 'dataEngine') return de
        return null
      }),
    },
    auth: { tenantId: 't1', orgId: 'o1' },
    selectedOrganizationId: 'o1',
    organizationIds: ['o1'],
    organizationScope: null,
    request: null,
  } as any
}

describe('addCertificationCommand — enhanced fields', () => {
  beforeEach(() => jest.clearAllMocks())

  it('passes enhanced fields to createOrmEntity', async () => {
    const ctx = createCtx()
    await addCertificationCommand.execute({
      technician_id: VALID_UUID,
      name: 'ISO 9001',
      cert_type: 'quality',
      code: 'ISO-001',
      issued_at: '2026-01-01T00:00:00Z',
      expires_at: '2028-01-01T00:00:00Z',
      issued_by: 'TUV',
      notes: 'Annual',
    }, ctx)

    const de = ctx.container.resolve('dataEngine')
    expect(de.createOrmEntity).toHaveBeenCalledTimes(1)
    const data = de.createOrmEntity.mock.calls[0][0].data
    expect(data.certType).toBe('quality')
    expect(data.code).toBe('ISO-001')
    expect(data.issuedBy).toBe('TUV')
    expect(data.notes).toBe('Annual')
    expect(data.issuedAt).toBeInstanceOf(Date)
    expect(data.expiresAt).toBeInstanceOf(Date)
  })

  it('handles missing enhanced fields as null', async () => {
    const ctx = createCtx()
    await addCertificationCommand.execute({
      technician_id: VALID_UUID,
      name: 'Basic Cert',
    }, ctx)

    const de = ctx.container.resolve('dataEngine')
    const data = de.createOrmEntity.mock.calls[0][0].data
    expect(data.certType).toBeNull()
    expect(data.code).toBeNull()
    expect(data.issuedBy).toBeNull()
    expect(data.notes).toBeNull()
  })
})

describe('updateCertificationCommand — enhanced fields', () => {
  beforeEach(() => jest.clearAllMocks())

  it('applies enhanced field updates', async () => {
    const mockEntity = {
      id: CERT_UUID,
      name: 'ISO 9001',
      certType: null,
      code: null,
      issuedBy: null,
      notes: null,
      certificateNumber: null,
      issuedAt: null,
      expiresAt: null,
    }
    const updateFn = jest.fn().mockImplementation(async ({ apply }) => {
      apply(mockEntity)
      return mockEntity
    })
    const ctx = createCtx({ updateOrmEntity: updateFn })

    await updateCertificationCommand.execute({
      id: CERT_UUID,
      notes: 'Renewed annually',
      cert_type: 'quality',
      issued_by: 'TUV',
    }, ctx)

    expect(mockEntity.notes).toBe('Renewed annually')
    expect(mockEntity.certType).toBe('quality')
    expect(mockEntity.issuedBy).toBe('TUV')
    // Unchanged fields stay null
    expect(mockEntity.code).toBeNull()
  })

  it('only updates provided fields', async () => {
    const mockEntity = {
      id: CERT_UUID,
      name: 'Original',
      certType: 'quality',
      code: 'C-001',
      issuedBy: 'TUV',
      notes: 'Original notes',
      certificateNumber: 'CN-1',
      issuedAt: new Date('2026-01-01'),
      expiresAt: new Date('2028-01-01'),
    }
    const updateFn = jest.fn().mockImplementation(async ({ apply }) => {
      apply(mockEntity)
      return mockEntity
    })
    const ctx = createCtx({ updateOrmEntity: updateFn })

    await updateCertificationCommand.execute({
      id: CERT_UUID,
      notes: 'Updated notes only',
    }, ctx)

    expect(mockEntity.notes).toBe('Updated notes only')
    // All other fields unchanged
    expect(mockEntity.name).toBe('Original')
    expect(mockEntity.certType).toBe('quality')
    expect(mockEntity.code).toBe('C-001')
    expect(mockEntity.issuedBy).toBe('TUV')
  })
})
