// `udb.from(table)` — drop-in for `supabase.from(table)` on personal tables.
//
// It records the query chain (select / eq / order / insert / upsert / delete …)
// and, when awaited:
//   • Private history ON + unlocked → runs it against the decrypted vault in
//     memory, then re-encrypts and saves (nothing readable reaches Supabase).
//   • Private history ON + locked   → reads return nothing, writes are refused
//     (so nothing leaks into the readable tables by accident).
//   • Private history OFF           → replays the exact chain on Supabase.
import { supabase } from '../supabase'
import { initVault, vaultActive, vaultLocked, vaultTables, markDirty } from './vault'

const CHAIN = ['select', 'eq', 'neq', 'in', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'upsert', 'update', 'delete']

class Query {
  constructor(table) { this.table = table; this.ops = [] }
  then(resolve, reject) { return this.run().then(resolve, reject) }
  catch(reject) { return this.run().catch(reject) }
  async run() {
    const { data } = await supabase.auth.getSession()
    await initVault(data?.session?.user?.id)
    if (vaultActive()) return runOnVault(this.table, this.ops)
    if (vaultLocked()) return lockedResult(this.ops)
    let q = supabase.from(this.table)
    for (const op of this.ops) q = q[op.name](...op.args)
    return q
  }
}
for (const name of CHAIN) {
  Query.prototype[name] = function (...args) { this.ops.push({ name, args }); return this }
}

export const udb = { from: (table) => new Query(table) }

// ── Locked: never write plaintext, never pretend data exists ────────────────
function lockedResult(ops) {
  const write = ops.find((o) => ['insert', 'upsert', 'update', 'delete'].includes(o.name))
  if (write) return { data: null, error: { message: 'Private history is locked. Unlock it in Profile.' } }
  const single = ops.some((o) => o.name === 'single' || o.name === 'maybeSingle')
  return { data: single ? null : [], error: null }
}

// ── Vault execution ──────────────────────────────────────────────────────────
const same = (a, b) => a != null && b != null && String(a) === String(b)

function runOnVault(table, ops) {
  const tables = vaultTables()
  if (!tables[table]) tables[table] = []
  const rows = tables[table]

  const filters = ops.filter((o) => ['eq', 'neq', 'in'].includes(o.name))
  const match = (r) => filters.every(({ name, args: [col, val] }) =>
    name === 'eq' ? same(r[col], val) : name === 'neq' ? !same(r[col], val) : (val || []).some((v) => same(r[col], v)))
  const order = ops.find((o) => o.name === 'order')
  const limit = ops.find((o) => o.name === 'limit')?.args[0]
  const single = ops.find((o) => o.name === 'single' || o.name === 'maybeSingle')
  const write = ops.find((o) => ['insert', 'upsert', 'update', 'delete'].includes(o.name))
  const now = new Date().toISOString()
  const withDefaults = (r) => ({
    id: r.id ?? (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
    added_at: r.added_at ?? now,
    updated_at: r.updated_at ?? now,
    ...r,
  })

  let out = []
  if (!write) {
    out = rows.filter(match)
  } else if (write.name === 'insert') {
    const list = (Array.isArray(write.args[0]) ? write.args[0] : [write.args[0]]).map(withDefaults)
    rows.push(...list)
    out = list
    markDirty()
  } else if (write.name === 'upsert') {
    const list = Array.isArray(write.args[0]) ? write.args[0] : [write.args[0]]
    const keys = String(write.args[1]?.onConflict || 'id').split(',').map((s) => s.trim())
    for (const r of list) {
      const i = rows.findIndex((x) => keys.every((k) => same(x[k], r[k])))
      if (i >= 0) { rows[i] = { ...rows[i], ...r }; out.push(rows[i]) } else { const n = withDefaults(r); rows.push(n); out.push(n) }
    }
    markDirty()
  } else if (write.name === 'update') {
    for (const r of rows) if (match(r)) { Object.assign(r, write.args[0]); out.push(r) }
    markDirty()
  } else if (write.name === 'delete') {
    out = rows.filter(match)
    tables[table] = rows.filter((r) => !match(r))
    markDirty()
  }

  if (order) {
    const [col, opt] = order.args
    const asc = opt?.ascending !== false
    out = [...out].sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (asc ? 1 : -1))
  }
  if (limit != null) out = out.slice(0, limit)
  const copy = (r) => (r ? JSON.parse(JSON.stringify(r)) : r)
  if (single) return { data: copy(out[0] ?? null), error: null }
  return { data: out.map(copy), error: null }
}
