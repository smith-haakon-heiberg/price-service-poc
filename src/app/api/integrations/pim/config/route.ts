import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readIntegratorConfig, writeIntegratorConfig } from '@/infrastructure/pim/integrator-config-store';
import type { IntegratorConfig } from '@/domain/pim-integrator';

export async function GET() {
  const config = readIntegratorConfig();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const body = await request.json() as IntegratorConfig;
  writeIntegratorConfig(body);
  return NextResponse.json(body);
}
