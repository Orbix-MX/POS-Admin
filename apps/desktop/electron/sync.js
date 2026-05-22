import { markSaleSynced, markSaleError, markCashMovementSynced, markCashMovementError } from './db';
// ── Product / Customer cache ──────────────────────────────────────────────────
export function cacheProducts(db, products) {
    const upsert = db.prepare(`
    INSERT OR REPLACE INTO products_cache
      (id, sku, name, price, cost_price, stock, category_id, category_name, status,
       track_inventory, low_stock_alert, tax_rate, tax_code, image_url, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const now = Date.now();
    const insertMany = db.transaction((rows) => {
        for (const p of rows) {
            const images = Array.isArray(p.images) ? p.images : [];
            const primaryImage = images.find((i) => i.isPrimary) ?? images[0];
            upsert.run(p.id, p.sku, p.name, p.price, p.costPrice ?? 0, p.stock ?? 0, p.categoryId ?? null, typeof p.category === 'object' && p.category !== null ? p.category.name : null, p.status ?? 'ACTIVE', p.trackInventory ? 1 : 0, p.lowStockAlert ?? 10, p.taxRate ?? 0, p.taxCode ?? '', primaryImage?.url ?? null, now);
        }
    });
    insertMany(products);
}
export function cacheCustomers(db, customers) {
    const upsert = db.prepare(`
    INSERT OR REPLACE INTO customers_cache
      (id, email, first_name, last_name, phone, status, type, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const now = Date.now();
    const insertMany = db.transaction((rows) => {
        for (const c of rows) {
            upsert.run(c.id, c.email ?? null, c.firstName, c.lastName, c.phone ?? null, c.status ?? 'ACTIVE', c.type ?? 'NEW', now);
        }
    });
    insertMany(customers);
}
// ── Sync queue ────────────────────────────────────────────────────────────────
export async function syncPendingSales(db, apiBase, token) {
    const pending = db.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all();
    let synced = 0;
    let errors = 0;
    for (const sale of pending) {
        try {
            db.prepare("UPDATE pending_sales SET status = 'syncing' WHERE id = ?").run(sale.id);
            const items = JSON.parse(sale.items);
            const body = {
                offlineId: sale.id,
                clienteId: sale.client_id ?? null,
                items,
                subtotal: sale.subtotal,
                descuentos: sale.discount,
                tax: sale.tax,
                total: sale.total,
                metodoPago: sale.payment_method,
                pagoCon: sale.payment_amount,
                cambio: sale.change_amount,
                notas: sale.notes ?? null,
            };
            const res = await fetch(`${apiBase}/pos/ventas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(15_000),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => res.statusText);
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            markSaleSynced(db, sale.id);
            synced++;
        }
        catch (err) {
            markSaleError(db, sale.id, String(err));
            errors++;
        }
    }
    return { synced, errors };
}
export async function syncPendingCashMovements(db, apiBase, token) {
    const pending = db.prepare("SELECT * FROM pending_cash_movements WHERE status = 'pending' ORDER BY created_at ASC").all();
    let synced = 0;
    let errors = 0;
    for (const m of pending) {
        try {
            db.prepare("UPDATE pending_cash_movements SET status = 'syncing' WHERE id = ?").run(m.id);
            const res = await fetch(`${apiBase}/cash-sessions/${m.session_id}/movements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    offlineId: m.id,
                    type: m.type,
                    amount: m.amount,
                    concept: m.concept,
                    notes: m.notes ?? null,
                }),
                signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => res.statusText);
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            markCashMovementSynced(db, m.id);
            synced++;
        }
        catch (err) {
            markCashMovementError(db, m.id, String(err));
            errors++;
        }
    }
    return { synced, errors };
}
