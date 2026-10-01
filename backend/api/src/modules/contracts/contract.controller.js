const contractService = require('./contract.service');

class ContractController {
  async getSignalContracts(req, res, next) {
    try {
      const { signal } = req.params;
      const data = await contractService.getContractsForSignal(signal);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async activateContract(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.user ? req.user.sub : 'operator';
      const result = await contractService.activateContract(id, actor);
      res.status(200).json({
        status: 'success',
        message: `Semantic contract version ${result.semantic_version} activated for ${result.canonical_name}`,
        contract: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ContractController();
