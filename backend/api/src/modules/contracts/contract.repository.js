const db = require('../../shared/db');
const crypto = require('crypto');

class ContractRepository {
  async getBySignal(signalName) {
    if (db.isLive()) {
      const res = await db.query(
        'SELECT * FROM signal_contract WHERE canonical_name = $1 ORDER BY semantic_version DESC',
        [signalName]
      );
      return res.rows;
    }
    const all = Array.from(db.inMemoryStore.contracts.values());
    return all
      .filter((c) => c.canonical_name === signalName)
      .sort((a, b) => b.semantic_version - a.semantic_version);
  }

  async getActiveContract(signalName) {
    const contracts = await this.getBySignal(signalName);
    return contracts.find((c) => c.active_to === null) || contracts[0] || null;
  }

  async getById(id) {
    if (db.isLive()) {
      const res = await db.query('SELECT * FROM signal_contract WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return db.inMemoryStore.contracts.get(id) || null;
  }

  async activateContract(id) {
    const target = await this.getById(id);
    if (!target) return null;

    if (db.isLive()) {
      await db.query(
        'UPDATE signal_contract SET active_to = NOW() WHERE canonical_name = $1 AND id != $2 AND active_to IS NULL',
        [target.canonical_name, id]
      );
      const res = await db.query(
        'UPDATE signal_contract SET active_to = NULL WHERE id = $1 RETURNING *',
        [id]
      );
      return res.rows[0];
    }

    // In-memory update
    for (const [cId, c] of db.inMemoryStore.contracts.entries()) {
      if (c.canonical_name === target.canonical_name && cId !== id) {
        c.active_to = new Date();
      }
    }
    target.active_to = null;
    db.inMemoryStore.contracts.set(id, target);
    return target;
  }

  async getContractChanges(signalName) {
    if (db.isLive()) {
      const res = await db.query(
        'SELECT * FROM contract_change WHERE canonical_name = $1 ORDER BY released_at DESC',
        [signalName]
      );
      return res.rows;
    }
    const all = Array.from(db.inMemoryStore.contractChanges.values());
    return all.filter((c) => !signalName || c.canonical_name === signalName);
  }
}

module.exports = new ContractRepository();
