/**
 * Evidencia de recuperación de borradores (OR — captura sin pérdidas).
 *
 * Reproduce el ciclo captura → muerte del proceso → recuperación usando el DDL
 * REAL (`SCHEMA_SQL` de src/db/schema.ts) y el MISMO SQL de los repositorios,
 * sobre un archivo SQLite real. Cerrar y reabrir el archivo modela de forma
 * idéntica los tres casos pedidos: cierre forzado de la app, kill del proceso en
 * Android y reinicio del dispositivo — en los tres muere la memoria de React
 * (localItems) y solo sobrevive el disco.
 *
 *   pnpm exec tsx scripts/verify-draft-recovery.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { SCHEMA_SQL, TABLES } from '../src/db/schema.ts';

const DB_PATH = join(tmpdir(), `orbix-recovery-${Date.now()}.db`);
let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  cond ? pass++ : fail++;
};

// Abre el archivo (= proceso vivo). Cerrarlo simula la muerte del proceso.
const openDb = () => {
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA_SQL);
  return db;
};

// ── SQL idéntico al de los repositorios (order-repository / order-item-repository) ──
const insertOrder = (db: DatabaseSync, o: Record<string, unknown>) =>
  db.prepare(
    `INSERT INTO ${TABLES.orders}
      (id, server_id, branch_id, table_id, reference, service_type, status, subtotal, synced, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(o.id, o.server_id, o.branch_id, o.table_id, o.reference, o.service_type, o.status, o.subtotal, o.synced, o.created_at, o.updated_at);

const insertItem = (db: DatabaseSync, i: Record<string, unknown>) =>
  db.prepare(
    `INSERT INTO ${TABLES.orderItems}
      (id, order_id, server_id, product_id, product_name, unit_price, quantity, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(i.id, i.order_id, i.server_id, i.product_id, i.product_name, i.unit_price, i.quantity, i.notes, i.created_at);

const updateItemQty = (db: DatabaseSync, id: string, qty: number) =>
  db.prepare(`UPDATE ${TABLES.orderItems} SET quantity = ? WHERE id = ?`).run(qty, id);

// findLocalDrafts
const findLocalDrafts = (db: DatabaseSync, branchId: string) =>
  db.prepare(
    `SELECT * FROM ${TABLES.orders} WHERE branch_id = ? AND server_id IS NULL AND status = 'OPEN' ORDER BY created_at DESC`,
  ).all(branchId) as Array<Record<string, unknown>>;

// findByOrder
const findByOrder = (db: DatabaseSync, orderId: string) =>
  db.prepare(`SELECT * FROM ${TABLES.orderItems} WHERE order_id = ? ORDER BY created_at ASC`).all(orderId) as Array<Record<string, unknown>>;

// deleteServerLinkedDrafts
const deleteServerLinkedDrafts = (db: DatabaseSync, branchId: string) =>
  db.prepare(
    `DELETE FROM ${TABLES.orders} WHERE branch_id = ? AND server_id IS NOT NULL AND synced = 0 AND status = 'OPEN'`,
  ).run(branchId);

const countOrders = (db: DatabaseSync) =>
  (db.prepare(`SELECT count(*) AS n FROM ${TABLES.orders}`).get() as { n: number }).n;

const BRANCH = 'branch-1';
const now = () => new Date().toISOString();

try {
  console.log(`DB temporal: ${DB_PATH}\n`);

  // ── ESCENARIO A: captura online interrumpida por cierre forzado ──────────────
  // El operador agrega 2 productos a una mesa (draft). NO envió aún. La app se
  // cierra de golpe → la memoria React se pierde.
  {
    const db = openDb();
    const orderId = 'draft-A';
    insertOrder(db, {
      id: orderId, server_id: null, branch_id: BRANCH, table_id: 'mesa-5', reference: 'Mesa 5',
      service_type: 'DINE_IN', status: 'OPEN', subtotal: 0, synced: 0, created_at: now(), updated_at: now(),
    });
    insertItem(db, { id: 'it-A1', order_id: orderId, server_id: null, product_id: 'p1', product_name: 'Tacos', unit_price: 50, quantity: 2, notes: 'sin cebolla', created_at: now() });
    insertItem(db, { id: 'it-A2', order_id: orderId, server_id: null, product_id: 'p2', product_name: 'Refresco', unit_price: 25, quantity: 1, notes: null, created_at: now() });
    db.close(); // ← CIERRE FORZADO DE LA APP

    const db2 = openDb(); // ← reapertura: recuperación
    const drafts = findLocalDrafts(db2, BRANCH);
    const items = drafts.length ? findByOrder(db2, drafts[0].id as string) : [];
    ok('A.1 cierre forzado: el borrador sobrevive', drafts.length === 1 && drafts[0].id === orderId);
    ok('A.2 cierre forzado: los 2 productos se recuperan', items.length === 2);
    ok('A.3 cierre forzado: cantidades/notas intactas',
      items[0].quantity === 2 && items[0].notes === 'sin cebolla' && items[1].quantity === 1);
    db2.close();
  }

  // ── ESCENARIO B: kill del proceso (Android) tras editar cantidad ─────────────
  {
    const db = openDb();
    updateItemQty(db, 'it-A1', 5); // operador sube Tacos a 5; se persiste de inmediato
    db.close(); // ← KILL DEL PROCESO (swipe / Android low-memory killer)

    const db2 = openDb();
    const items = findByOrder(db2, 'draft-A');
    ok('B.1 kill Android: la edición persistida se recupera', items.find((i) => i.id === 'it-A1')?.quantity === 5);
    db2.close();
  }

  // ── ESCENARIO C: reinicio del dispositivo + limpieza de envío interrumpido ───
  // Un segundo draft alcanzó a crear su orden en el servidor (server_id) pero el
  // envío se cortó antes de marcarse sincronizado. Tras reiniciar, ese resto se
  // purga (el servidor es autoritativo) sin tocar el borrador limpio.
  {
    const db = openDb();
    insertOrder(db, {
      id: 'draft-C-leftover', server_id: 'srv-99', branch_id: BRANCH, table_id: 'mesa-9', reference: 'Mesa 9',
      service_type: 'DINE_IN', status: 'OPEN', subtotal: 0, synced: 0, created_at: now(), updated_at: now(),
    });
    db.close(); // ← REINICIO DEL DISPOSITIVO

    const db2 = openDb();
    const before = countOrders(db2);
    deleteServerLinkedDrafts(db2, BRANCH); // limpieza en la recuperación
    const drafts = findLocalDrafts(db2, BRANCH);
    ok('C.1 reinicio: el borrador limpio sigue presente', drafts.some((d) => d.id === 'draft-A'));
    ok('C.2 reinicio: el resto de envío interrumpido se purga',
      before === 2 && !findLocalDrafts(db2, BRANCH).some((d) => d.id === 'draft-C-leftover') && countOrders(db2) === 1);
    ok('C.3 reinicio: el borrador limpio conserva sus productos', findByOrder(db2, 'draft-A').length === 2);
    db2.close();
  }

  console.log(`\nResultado: ${pass} OK, ${fail} fallos`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  rmSync(DB_PATH, { force: true });
  rmSync(`${DB_PATH}-wal`, { force: true });
  rmSync(`${DB_PATH}-shm`, { force: true });
}
