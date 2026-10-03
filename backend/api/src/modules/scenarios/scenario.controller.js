const scenarioService = require('./scenario.service');

class ScenarioController {
  getAvailable(req, res) {
    const list = scenarioService.getAvailableScenarios();
    const active = scenarioService.getActiveScenarios();
    res.status(200).json({ available: list, active });
  }

  async start(req, res, next) {
    try {
      const { scenario, cohort, durationSeconds } = req.body;
      if (!scenario) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: '"scenario" is required.' });
      }

      const result = await scenarioService.startScenario({
        scenario,
        cohort,
        durationSeconds: durationSeconds || 120,
        tenantId: req.tenantId || 'tenant-default'
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async stop(req, res, next) {
    try {
      const { scenarioId } = req.body;
      if (!scenarioId) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: '"scenarioId" is required.' });
      }

      const result = await scenarioService.stopScenario(scenarioId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ScenarioController();
