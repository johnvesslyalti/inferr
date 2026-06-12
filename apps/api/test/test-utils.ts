import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DRIZZLE } from '../src/db/drizzle.provider';
import type { DrizzleDB } from '../src/db/drizzle.provider';

// Use a stable test secret. Tests and guards must agree on it.
export const TEST_JWT_SECRET = 'test-jwt-secret-for-api-tests-1234567890abcdef';

// A minimal seeded test user shape matching the real seeded one + common fields.
export const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'testuser@example.com',
  name: 'Test User',
  avatar: null,
  googleId: 'test-google-id-001',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

// Payload shape expected by JwtAuthGuard and AuthService.signAccessToken
export interface TestJwtUser {
  id: string;
  email: string;
  name: string;
}

let jwtService: JwtService | null = null;

async function getTestJwtService(): Promise<JwtService> {
  if (jwtService) return jwtService;
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    ],
  }).compile();
  jwtService = module.get<JwtService>(JwtService);
  return jwtService;
}

/**
 * Mint a short-lived access JWT for a test user.
 * Matches exactly the payload + options used by AuthService.signAccessToken.
 * Safe to call from beforeAll / beforeEach in specs.
 */
export async function mintAccessToken(
  user: Partial<TestJwtUser> = {},
): Promise<string> {
  const svc = await getTestJwtService();
  const payload = {
    sub: user.id ?? TEST_USER.id,
    email: user.email ?? TEST_USER.email,
    name: user.name ?? TEST_USER.name,
  };
  return svc.sign(payload, { expiresIn: '15m' });
}

/**
 * Convenience: returns both the user object and a fresh token for it.
 */
export async function getTestAuthContext(overrides?: Partial<TestJwtUser>) {
  const user: TestJwtUser = {
    id: overrides?.id ?? TEST_USER.id,
    email: overrides?.email ?? TEST_USER.email,
    name: overrides?.name ?? TEST_USER.name,
  };
  const token = await mintAccessToken(user);
  return { user, token, authHeader: `Bearer ${token}` };
}

/**
 * Create a simple jest mock for the DRIZZLE provider (the injected db).
 * Covers the common methods used across services: select/insert/update/execute + chainers.
 * Extend per-test with .mockResolvedValue etc.
 *
 * Usage in Test.createTestingModule:
 *   providers: [
 *     { provide: DRIZZLE, useValue: createMockDrizzle() },
 *     ...
 *   ]
 */
export function createMockDrizzle(): jest.Mocked<DrizzleDB> {
  // Build a chainable mock that most drizzle calls expect: .from().where().limit() etc returning { then, ... } or direct awaitable
  const makeChain = (finalValue: unknown) => {
    const chain: any = {
      from: jest.fn(() => chain),
      where: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      orderBy: jest.fn(() => chain),
      returning: jest.fn(() => Promise.resolve(finalValue)),
      onConflictDoNothing: jest.fn(() => chain),
      onConflictDoUpdate: jest.fn(() => chain),
      set: jest.fn(() => chain),
      values: jest.fn(() => chain),
      // For raw execute(sql`...`)
      then: (cb?: any) => Promise.resolve(finalValue).then(cb),
      catch: (cb?: any) => Promise.resolve(finalValue).catch(cb),
    };
    // Make the chain itself thenable so `await db.execute(...)` or `await db.select()...` works
    const promise = Promise.resolve(finalValue);
    Object.assign(chain, {
      [Symbol.toStringTag]: 'Promise',
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    });
    return chain;
  };

  const mockDb: any = {
    select: jest.fn((cols?: any) => makeChain([])),
    insert: jest.fn((table?: any) => makeChain([])),
    update: jest.fn((table?: any) => makeChain([])),
    delete: jest.fn((table?: any) => makeChain([])),
    execute: jest.fn((query?: any) =>
      Promise.resolve({ rows: [], rowCount: 0 }),
    ),
    // Drizzle transaction helper used in auth rotate
    transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
      // Provide a tx that delegates to same mock chains
      const tx = {
        insert: mockDb.insert,
        update: mockDb.update,
        select: mockDb.select,
        execute: mockDb.execute,
      };
      return fn(tx);
    }),
    // Allow direct query if used
    query: {},
  };

  return mockDb as jest.Mocked<DrizzleDB>;
}

/**
 * Helper to quickly override process.env.JWT_SECRET for a test suite.
 * Call in beforeAll; restore in afterAll if needed.
 */
export function setTestJwtEnv() {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
}

export function restoreTestJwtEnv(original?: string) {
  if (original !== undefined) {
    process.env.JWT_SECRET = original;
  } else {
    delete process.env.JWT_SECRET;
  }
}
