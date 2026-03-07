import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { HttpPimProvider } from '@/infrastructure/pim/http-pim-provider';
import type { ProviderConfig, FieldMappings } from '@/domain/pim-integrator';

export async function POST(request: NextRequest) {
  const body = await request.json() as { provider: ProviderConfig; mappings: FieldMappings };

  if (!body.provider?.baseUrl) {
    return NextResponse.json({ error: 'provider.baseUrl is required' }, { status: 400 });
  }

  try {
    const pim = new HttpPimProvider(body.provider, body.mappings);
    const products = await pim.getProducts({ limit: 20 });
    return NextResponse.json({ products, count: products.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
