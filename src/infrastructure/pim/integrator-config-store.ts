import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { IntegratorConfig } from '@/domain/pim-integrator';
import { DEFAULT_INTEGRATOR_CONFIG } from '@/domain/pim-integrator';

const CONFIG_PATH = join(process.cwd(), 'data', 'pim-integrator.json');

export function readIntegratorConfig(): IntegratorConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_INTEGRATOR_CONFIG };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as IntegratorConfig;
  } catch {
    return { ...DEFAULT_INTEGRATOR_CONFIG };
  }
}

export function writeIntegratorConfig(config: IntegratorConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
