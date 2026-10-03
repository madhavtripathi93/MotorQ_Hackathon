const { z } = require('zod');

const createContractSchema = z.object({
  canonical_name: z.string().min(1),
  semantic_version: z.number().int().positive(),
  unit: z.string().min(1),
  source_ecu: z.string().optional(),
  sampling_hz: z.number().positive().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  semantics_json: z.record(z.any()).default({}),
  active_from: z.string().datetime().optional(),
});

module.exports = {
  createContractSchema,
};
