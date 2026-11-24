/**
 * In-memory stand-in for the service-role Supabase client, for unit tests.
 *
 * Supports the query-builder subset the API uses: select / insert / update /
 * upsert / delete, eq / neq / in / is / gt / gte / lt / lte / ilike /
 * contains filters, not(col, 'in' | 'is' | 'eq', v), or('a.eq.x,b.ilike.%y%'),
 * order, range, limit, single, maybeSingle, count + head, rpc, auth.getUser,
 * auth.admin.updateUserById / deleteUser and a small in-memory storage
 * (createSignedUploadUrl / list / remove / getPublicUrl).
 * Embedded selects ("service:services(...)") are ignored: rows come back with
 * their own columns only. Filters on embedded paths ("booking.barber_id") are
 * ignored too. Unique columns and custom constraints can be declared per table.
 *
 * Not imported by production code.
 */

export type Row = Record<string, unknown>
export interface FakeError {
  code?: string
  message: string
}
type Result = { data: unknown; error: FakeError | null; count?: number | null }
type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete'
type Filter = (row: Row) => boolean

export interface FakeUser {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export interface StoredObject {
  bucket: string
  path: string
}

export interface LoggedCall {
  table: string
  op: Op
  payload?: unknown
}

let idCounter = 0
export function fakeUuid(): string {
  idCounter += 1
  const hex = idCounter.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

export class FakeDb {
  tables: Record<string, Row[]> = {}
  /** Single-column unique keys per table (in addition to `id`). */
  unique: Record<string, string[]> = {}
  /** Extra checks run before a row is written; return an error to reject it. */
  constraints: Record<string, (candidate: Row, others: Row[]) => FakeError | null> = {}
  rpcHandlers: Record<string, (args: Record<string, unknown>, db: FakeDb) => Result> = {}
  users = new Map<string, FakeUser>()
  log: LoggedCall[] = []
  private failures: Array<{ table: string; op: Op; error: FakeError }> = []

  /** Calls made to auth.admin.updateUserById, in order. */
  adminUserUpdates: Array<{ id: string; attributes: Record<string, unknown> }> = []
  /** Calls made to auth.admin.deleteUser, in order. */
  adminUserDeletes: Array<{ id: string; soft: boolean }> = []
  /** Stored objects per bucket: path -> metadata. */
  objects: Record<string, Map<string, Record<string, unknown>>> = {}
  storageUrl = 'http://localhost:54321'

  auth = {
    getUser: async (token: string) => {
      const user = this.users.get(token)
      if (!user) {
        return { data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } }
      }
      return { data: { user: { app_metadata: {}, user_metadata: {}, ...user } }, error: null }
    },
    admin: {
      /** Soft delete (GoTrue): the token stops working; the profile row is untouched. */
      deleteUser: async (id: string, shouldSoftDelete = false) => {
        const failure = this.takeFailure('auth.users', 'delete')
        if (failure) return { data: { user: null }, error: failure }
        this.adminUserDeletes.push({ id, soft: shouldSoftDelete })
        for (const [token, user] of this.users) if (user.id === id) this.users.delete(token)
        return { data: { user: { id } }, error: null }
      },
      updateUserById: async (id: string, attributes: Record<string, unknown>) => {
        const failure = this.takeFailure('auth.users', 'update')
        if (failure) return { data: { user: null }, error: failure }
        this.adminUserUpdates.push({ id, attributes })
        const user = [...this.users.values()].find((u) => u.id === id)
        if (user && typeof attributes.email === 'string') user.email = attributes.email
        return { data: { user: user ? { ...user } : { id } }, error: null }
      },
    },
  }

  storage = {
    from: (bucket: string) => {
      const files = () => {
        if (!this.objects[bucket]) this.objects[bucket] = new Map()
        return this.objects[bucket]
      }
      return {
        createSignedUploadUrl: async (path: string) => {
          const failure = this.takeFailure(`storage.${bucket}`, 'insert')
          if (failure) return { data: null, error: failure }
          const token = `upload-token-${fakeUuid()}`
          return {
            data: { path, token, signedUrl: `${this.storageUrl}/storage/v1/object/upload/sign/${bucket}/${path}?token=${token}` },
            error: null,
          }
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `${this.storageUrl}/storage/v1/object/public/${bucket}/${path}` },
        }),
        /** Lists one folder level like Storage: files, plus folders as entries with id null. */
        list: async (prefix = '', options: { limit?: number; offset?: number } = {}) => {
          const failure = this.takeFailure(`storage.${bucket}`, 'select')
          if (failure) return { data: null, error: failure }
          const base = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''
          const entries = new Map<string, Record<string, unknown>>()
          for (const path of [...files().keys()].sort()) {
            if (!path.startsWith(base)) continue
            const rest = path.slice(base.length)
            const [head, ...tail] = rest.split('/')
            if (tail.length > 0) entries.set(head, { name: head, id: null })
            else entries.set(head, { name: head, id: `obj-${path}` })
          }
          const offset = options.offset ?? 0
          const limit = options.limit ?? 100
          return { data: [...entries.values()].slice(offset, offset + limit), error: null }
        },
        remove: async (paths: string[]) => {
          const failure = this.takeFailure(`storage.${bucket}`, 'delete')
          if (failure) return { data: null, error: failure }
          const removed = paths.filter((p) => files().delete(p)).map((name) => ({ name, bucket_id: bucket }))
          return { data: removed, error: null }
        },
      }
    },
  }

  /** Puts an object into the fake storage. */
  putObject(bucket: string, path: string, meta: Record<string, unknown> = {}): void {
    if (!this.objects[bucket]) this.objects[bucket] = new Map()
    this.objects[bucket].set(path, meta)
  }

  storedObjects(): StoredObject[] {
    return Object.entries(this.objects).flatMap(([bucket, files]) => [...files.keys()].map((path) => ({ bucket, path })))
  }

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [table, rows] of Object.entries(seed)) this.tables[table] = rows.map((r) => ({ ...r }))
  }

  table(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = []
    return this.tables[name]
  }

  rows(name: string, where: Row = {}): Row[] {
    return this.table(name).filter((r) => Object.entries(where).every(([k, v]) => r[k] === v))
  }

  one(name: string, where: Row): Row | undefined {
    return this.rows(name, where)[0]
  }

  /** Makes the next `op` on `table` fail with `error`. */
  failNext(table: string, op: Op, error: FakeError): void {
    this.failures.push({ table, op, error })
  }

  takeFailure(table: string, op: Op): FakeError | null {
    const i = this.failures.findIndex((f) => f.table === table && f.op === op)
    if (i === -1) return null
    return this.failures.splice(i, 1)[0].error
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table)
  }

  rpc(name: string, args: Record<string, unknown>): PromiseLike<Result> {
    const handler = this.rpcHandlers[name]
    const result: Result = handler
      ? handler(args, this)
      : { data: null, error: { code: 'PGRST202', message: `function ${name} not found` } }
    return Promise.resolve(result)
  }

  /** Validates and stores a new row (defaults id/created_at/updated_at). */
  insertRow(table: string, input: Row): { row?: Row; error?: FakeError } {
    const now = new Date().toISOString()
    const row: Row = { id: fakeUuid(), created_at: now, updated_at: now, ...input }
    const error = this.check(table, row, null)
    if (error) return { error }
    this.table(table).push(row)
    return { row }
  }

  check(table: string, candidate: Row, replacing: Row | null): FakeError | null {
    const others = this.table(table).filter((r) => r !== replacing)
    for (const col of ['id', ...(this.unique[table] ?? [])]) {
      const v = candidate[col]
      if (v !== undefined && v !== null && others.some((r) => r[col] === v)) {
        return { code: '23505', message: `duplicate key value violates unique constraint on ${table}.${col}` }
      }
    }
    return this.constraints[table]?.(candidate, others) ?? null
  }
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  return String(a) < String(b) ? -1 : 1
}

export class FakeQuery implements PromiseLike<Result> {
  private op: Op = 'select'
  private payload: unknown
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  private filters: Filter[] = []
  private orders: Array<{ col: string; ascending: boolean }> = []
  private rangeFrom = 0
  private rangeTo = Infinity
  private returning = false
  private mode: 'many' | 'single' | 'maybeSingle' = 'many'
  private countRequested = false
  private head = false

  constructor(
    private db: FakeDb,
    private tableName: string
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }): this {
    if (this.op === 'select') {
      this.countRequested = !!options?.count
      this.head = !!options?.head
    } else {
      this.returning = true
    }
    return this
  }

  insert(payload: Row | Row[]): this {
    this.op = 'insert'
    this.payload = payload
    return this
  }

  update(payload: Row): this {
    this.op = 'update'
    this.payload = payload
    return this
  }

  upsert(payload: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.op = 'upsert'
    this.payload = payload
    this.upsertOptions = options
    return this
  }

  delete(): this {
    this.op = 'delete'
    return this
  }

  private where(col: string, test: (v: unknown) => boolean): this {
    if (col.includes('.')) return this // filter on an embedded resource: ignored
    this.filters.push((row) => test(row[col]))
    return this
  }

  eq(col: string, value: unknown) {
    return this.where(col, (v) => v === value)
  }
  neq(col: string, value: unknown) {
    return this.where(col, (v) => v !== value)
  }
  in(col: string, values: unknown[]) {
    return this.where(col, (v) => values.includes(v))
  }
  is(col: string, value: unknown) {
    return this.where(col, (v) => (value === null ? v === null || v === undefined : v === value))
  }
  gt(col: string, value: unknown) {
    return this.where(col, (v) => v !== null && v !== undefined && compareValues(v, value) > 0)
  }
  gte(col: string, value: unknown) {
    return this.where(col, (v) => v !== null && v !== undefined && compareValues(v, value) >= 0)
  }
  lt(col: string, value: unknown) {
    return this.where(col, (v) => v !== null && v !== undefined && compareValues(v, value) < 0)
  }
  lte(col: string, value: unknown) {
    return this.where(col, (v) => v !== null && v !== undefined && compareValues(v, value) <= 0)
  }

  ilike(col: string, pattern: string) {
    const re = likeToRegExp(pattern)
    return this.where(col, (v) => typeof v === 'string' && re.test(v))
  }
  contains(col: string, values: unknown[]) {
    return this.where(col, (v) => Array.isArray(v) && values.every((x) => v.includes(x)))
  }
  not(col: string, op: 'in' | 'is' | 'eq', value: unknown) {
    if (col.includes('.')) return this
    if (op === 'in') {
      const list = parseInList(String(value))
      this.filters.push((row) => !list.includes(String(row[col])))
    } else if (op === 'is') {
      this.filters.push((row) => (value === null || value === 'null' ? row[col] !== null && row[col] !== undefined : row[col] !== value))
    } else {
      this.filters.push((row) => row[col] !== value)
    }
    return this
  }
  /** PostgREST logic tree subset: comma-separated `col.op.value` with eq / ilike / in; values may be "quoted". */
  or(expression: string) {
    const parts = splitOr(expression).map((part) => {
      const m = /^([a-z_]+)\.(eq|ilike|in)\.(.*)$/.exec(part)
      if (!m) throw new Error(`FakeQuery.or: unsupported expression ${part}`)
      const [, col, op, raw] = m
      const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
      if (op === 'eq') return (row: Row) => String(row[col]) === value
      if (op === 'in') return (row: Row) => parseInList(value).includes(String(row[col]))
      const re = likeToRegExp(value)
      return (row: Row) => typeof row[col] === 'string' && re.test(String(row[col]))
    })
    this.filters.push((row) => parts.some((test) => test(row)))
    return this
  }

  order(col: string, options: { ascending?: boolean } = {}): this {
    this.orders.push({ col, ascending: options.ascending !== false })
    return this
  }

  range(from: number, to: number): this {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  limit(n: number): this {
    this.rangeTo = this.rangeFrom + n - 1
    return this
  }

  single(): this {
    this.mode = 'single'
    return this
  }

  maybeSingle(): this {
    this.mode = 'maybeSingle'
    return this
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected)
  }

  private matches(): Row[] {
    return this.db.table(this.tableName).filter((r) => this.filters.every((f) => f(r)))
  }

  private execute(): Result {
    this.db.log.push({ table: this.tableName, op: this.op, payload: this.payload })
    const failure = this.db.takeFailure(this.tableName, this.op)
    if (failure) return { data: null, error: failure }

    switch (this.op) {
      case 'select': {
        let rows = this.matches()
        for (const o of [...this.orders].reverse()) {
          rows = [...rows].sort((a, b) => compare(a[o.col], b[o.col]) * (o.ascending ? 1 : -1))
        }
        const count = rows.length
        rows = rows.slice(this.rangeFrom, this.rangeTo + 1)
        if (this.head) return { data: null, error: null, count }
        return this.shape(rows.map((r) => ({ ...r })), this.countRequested ? count : null)
      }
      case 'insert': {
        const inputs = Array.isArray(this.payload) ? (this.payload as Row[]) : [this.payload as Row]
        const created: Row[] = []
        for (const input of inputs) {
          const { row, error } = this.db.insertRow(this.tableName, input)
          if (error) {
            for (const r of created) this.db.table(this.tableName).splice(this.db.table(this.tableName).indexOf(r), 1)
            return { data: null, error }
          }
          created.push(row as Row)
        }
        return this.returning ? this.shape(created.map((r) => ({ ...r }))) : { data: null, error: null }
      }
      case 'update': {
        const patch = this.payload as Row
        const targets = this.matches()
        for (const row of targets) {
          const candidate = { ...row, ...patch, updated_at: new Date().toISOString() }
          const error = this.db.check(this.tableName, candidate, row)
          if (error) return { data: null, error }
        }
        for (const row of targets) Object.assign(row, patch, { updated_at: new Date().toISOString() })
        return this.returning ? this.shape(targets.map((r) => ({ ...r }))) : { data: null, error: null }
      }
      case 'upsert': {
        const inputs = Array.isArray(this.payload) ? (this.payload as Row[]) : [this.payload as Row]
        const keys = (this.upsertOptions.onConflict ?? 'id').split(',').map((k) => k.trim())
        const written: Row[] = []
        for (const input of inputs) {
          const existing = this.db.table(this.tableName).find((r) => keys.every((k) => r[k] === input[k]))
          if (existing) {
            if (this.upsertOptions.ignoreDuplicates) continue
            Object.assign(existing, input, { updated_at: new Date().toISOString() })
            written.push(existing)
          } else {
            const { row, error } = this.db.insertRow(this.tableName, input)
            if (error) return { data: null, error }
            written.push(row as Row)
          }
        }
        return this.returning ? this.shape(written.map((r) => ({ ...r }))) : { data: null, error: null }
      }
      case 'delete': {
        const targets = this.matches()
        const table = this.db.table(this.tableName)
        for (const row of targets) table.splice(table.indexOf(row), 1)
        return this.returning ? this.shape(targets) : { data: null, error: null }
      }
    }
  }

  private shape(rows: Row[], count: number | null = null): Result {
    if (this.mode === 'many') return { data: rows, error: null, count }
    if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
    if (rows.length === 0) {
      return this.mode === 'single'
        ? { data: null, error: { code: 'PGRST116', message: 'no rows' } }
        : { data: null, error: null }
    }
    return { data: rows[0], error: null }
  }
}

function likeToRegExp(pattern: string): RegExp {
  const literal = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let body = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\' && i + 1 < pattern.length) body += literal(pattern[++i]) // LIKE escape
    else if (ch === '%' || ch === '*') body += '.*'
    else if (ch === '_') body += '.'
    else body += literal(ch)
  }
  return new RegExp(`^${body}$`, 'is')
}

function parseInList(value: string): string[] {
  return value
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((v) => v.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

function splitOr(expression: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let quoted = false
  for (const ch of expression) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (ch === ',' && depth === 0 && !quoted) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const da = typeof a === 'string' ? Date.parse(a) : NaN
  const dbv = typeof b === 'string' ? Date.parse(b) : NaN
  if (Number.isFinite(da) && Number.isFinite(dbv) && /\d{4}-\d{2}-\d{2}T/.test(String(a))) return da - dbv
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

// ---------------------------------------------------------------------------
// Booking schema behaviour (mirrors supabase/migrations baseline)
// ---------------------------------------------------------------------------

const ACTIVE = ['pending', 'confirmed']

/** bookings_no_overlap: no two pending/confirmed bookings of a barber overlap ('[)' ranges). */
export function bookingOverlapConstraint(candidate: Row, others: Row[]): FakeError | null {
  if (!ACTIVE.includes(String(candidate.status))) return null
  const start = Date.parse(String(candidate.starts_at))
  const end = Date.parse(String(candidate.ends_at))
  const clash = others.some(
    (o) =>
      o.barber_id === candidate.barber_id &&
      ACTIVE.includes(String(o.status)) &&
      Date.parse(String(o.starts_at)) < end &&
      start < Date.parse(String(o.ends_at))
  )
  return clash ? { code: '23P01', message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"' } : null
}

/** A faithful-enough create_booking_hold (see the baseline migration). */
export function createBookingHoldRpc(args: Record<string, unknown>, db: FakeDb): Result {
  if (!args.p_hold_expires_at || Date.parse(String(args.p_hold_expires_at)) <= Date.now()) {
    return { data: null, error: { code: '22023', message: 'hold_expires_at must be in the future' } }
  }
  const service = db
    .table('services')
    .find((s) => s.id === args.p_service_id && s.barber_id === args.p_barber_id && s.is_active)
  if (!service) return { data: null, error: { code: '22023', message: 'service is not active' } }

  const addonIds = [...new Set((args.p_addon_ids as string[] | undefined) ?? [])]
  const addons = db
    .table('service_addons')
    .filter((a) => addonIds.includes(String(a.id)) && a.barber_id === args.p_barber_id && a.is_active)
  if (addons.length !== addonIds.length) {
    return { data: null, error: { code: '22023', message: 'add-on is not active' } }
  }

  const nowIso = new Date().toISOString()
  for (const b of db.table('bookings')) {
    if (
      b.barber_id === args.p_barber_id &&
      b.status === 'pending' &&
      b.hold_expires_at &&
      Date.parse(String(b.hold_expires_at)) < Date.now()
    ) {
      Object.assign(b, { status: 'cancelled', cancelled_at: nowIso, cancellation_reason: 'hold_expired', hold_expires_at: null })
    }
  }

  const startsAt = new Date(String(args.p_starts_at))
  const fee = Number(args.p_booking_fee_cents)
  const { row, error } = db.insertRow('bookings', {
    barber_id: args.p_barber_id,
    client_id: args.p_client_id,
    customer_name: null,
    service_id: args.p_service_id,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + Number(service.duration_minutes) * 60_000).toISOString(),
    source: 'app',
    status: 'pending',
    payment_status: fee > 0 ? 'pending' : 'none',
    hold_expires_at: args.p_hold_expires_at,
    service_price_cents: service.price_cents,
    addon_total_cents: addons.reduce((sum, a) => sum + Number(a.price_cents), 0),
    booking_fee_cents: fee,
    application_fee_cents: args.p_application_fee_cents,
    barber_fee_share_cents: args.p_barber_fee_share_cents,
    payment_intent_id: null,
    notes: args.p_notes ?? null,
    cancelled_at: null,
    cancellation_reason: null,
  })
  if (error) return { data: null, error }
  for (const a of addons) {
    db.insertRow('booking_addons', { booking_id: row?.id, addon_id: a.id, name: a.name, price_cents: a.price_cents })
  }
  return { data: { ...row }, error: null }
}

/** A FakeDb with the booking schema's constraints and RPC wired up. */
export function createBookingDb(seed: Record<string, Row[]> = {}): FakeDb {
  const db = new FakeDb(seed)
  db.unique = {
    bookings: ['payment_intent_id'],
    payments: ['stripe_object_id'],
    barber_billing: ['barber_id', 'stripe_account_id'],
  }
  db.constraints.bookings = bookingOverlapConstraint
  db.rpcHandlers.create_booking_hold = createBookingHoldRpc
  return db
}
