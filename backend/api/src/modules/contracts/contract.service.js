const contractRepo = require('./contract.repository');
const { publish } = require('../../shared/kafka/producer');
const logger = require('../../shared/logger');

class ContractService {
  async getContractsForSignal(signalName) {
    const contracts = await contractRepo.getBySignal(signalName);
    const changes = await contractRepo.getContractChanges(signalName);
    return {
      signal: signalName,
      contracts,
      changes,
    };
  }

  async activateContract(contractId, actor = 'operator') {
    const activated = await contractRepo.activateContract(contractId);
    if (!activated) {
      const err = new Error(`Contract with ID ${contractId} not found.`);
      err.statusCode = 404;
      err.code = 'CONTRACT_NOT_FOUND';
      throw err;
    }

    // Publish to contract.events.v1
    await publish('contract.events.v1', activated.canonical_name, {
      type: 'CONTRACT_ACTIVATED',
      contractId: activated.id,
      signal: activated.canonical_name,
      version: activated.semantic_version,
      activatedBy: actor,
      timestamp: new Date().toISOString(),
    });

    logger.info({
      signal: activated.canonical_name,
      version: activated.semantic_version,
      actor,
    }, 'Activated semantic contract version');

    return activated;
  }
}

module.exports = new ContractService();
