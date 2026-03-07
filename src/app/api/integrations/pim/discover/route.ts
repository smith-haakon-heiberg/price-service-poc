import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { discoverSchema } from '@/infrastructure/pim/discovery';
import type { ProviderConfig } from '@/domain/pim-integrator';
import { suggestMapping } from '@/domain/pim-integrator';

export async function POST(request: NextRequest) {
  const provider = await request.json() as ProviderConfig;

  if (!provider.baseUrl || !provider.productsPath) {
    return NextResponse.json(
      { error: 'baseUrl and productsPath are required' },
      { status: 400 },
    );
  }

  const result = await discoverSchema(provider);

  // Attach auto-suggested mappings for each field
  const suggestions: Record<string, string> = {};
  for (const field of result.fields) {
    const target = suggestMapping(field.path);
    if (target && !suggestions[target]) {
      suggestions[target] = field.path;
    }
  }

  return NextResponse.json({ ...result, suggestions });
}
