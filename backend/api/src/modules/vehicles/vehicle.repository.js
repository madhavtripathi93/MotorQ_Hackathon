const db = require('../../shared/db');

class VehicleRepository {
  async listVehicles({ tenantId, cursor, limit = 50, firmware }) {
    if (db.isLive()) {
      let queryText = 'SELECT * FROM vehicle WHERE tenant_id = $1';
      const params = [tenantId];

      if (firmware) {
        params.push(firmware);
        queryText += ` AND firmware_version = $${params.length}`;
      }

      if (cursor) {
        params.push(cursor);
        queryText += ` AND vin > $${params.length}`;
      }

      queryText += ` ORDER BY vin ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await db.query(queryText, params);
      return res.rows;
    }

    let items = Array.from(db.inMemoryStore.vehicles.values()).filter(
      (v) => v.tenant_id === tenantId
    );

    if (firmware) {
      items = items.filter((v) => v.firmware_version === firmware);
    }

    items.sort((a, b) => a.vin.localeCompare(b.vin));

    if (cursor) {
      items = items.filter((v) => v.vin > cursor);
    }

    return items.slice(0, limit);
  }

  async getByVin(vin, tenantId = 'tenant-default') {
    if (db.isLive()) {
      const res = await db.query('SELECT * FROM vehicle WHERE vin = $1 AND tenant_id = $2', [vin, tenantId]);
      return res.rows[0] || null;
    }
    const v = db.inMemoryStore.vehicles.get(vin);
    if (!v) return null;
    return (v.tenant_id === tenantId) ? v : null;
  }
}

module.exports = new VehicleRepository();
