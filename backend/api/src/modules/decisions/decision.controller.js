const decisionService = require('./decision.service');

class DecisionController {
  async evaluateDecision(req, res, next) {
    try {
      const tenantId = req.tenantId || 'tenant-default';
      const actor = req.user ? req.user.sub : 'operator';
      const { vin, requestedAction, incidentId, proposedBy } = req.body;

      if (!vin || !requestedAction) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Both "vin" and "requestedAction" are required.',
        });
      }

      const result = await decisionService.evaluateAction({
        tenantId,
        vin,
        requestedAction,
        incidentId,
        actor,
        aiProposed: proposedBy === 'ai_agent',
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // AI Agent tools endpoints
  async getTrust(req, res, next) {
    try {
      const { vin } = req.params;
      const { signal } = req.query;
      const tenantId = req.tenantId || (req.user && (req.user.tenant_id || req.user.tenantId)) || 'tenant-default';
      const data = await decisionService.getVehicleTrust(vin, signal || 'speed_kmh', tenantId);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async simulate(req, res, next) {
    try {
      const { vin, requestedAction } = req.body;
      const tenantId = req.tenantId || (req.user && (req.user.tenant_id || req.user.tenantId)) || 'tenant-default';
      const data = await decisionService.simulateAction({ vin, requestedAction, tenantId });
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DecisionController();
