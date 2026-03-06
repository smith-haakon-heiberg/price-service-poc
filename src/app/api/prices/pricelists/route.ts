import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';
import type { Pricelist } from '@/domain/types';

export async function GET() {
  try {
    const service = getPriceService();
    const pricelists = await service.listPricelists();
    return jsonResponse(pricelists);
  } catch (err) {
    console.error('Unexpected error in GET /api/prices/pricelists:', err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 'INVALID_BODY', 400);
  }

  const data = body as Record<string, unknown>;

  if (!data.name || typeof data.name !== 'string') {
    return errorResponse('Missing required field: name', 'MISSING_FIELD', 400);
  }
  if (!data.type || typeof data.type !== 'string') {
    return errorResponse('Missing required field: type', 'MISSING_FIELD', 400);
  }

  const validTypes = ['customer', 'project', 'member', 'outlet', 'general'] as const;
  if (!validTypes.includes(data.type as Pricelist['type'])) {
    return errorResponse(
      `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      'INVALID_FIELD',
      400
    );
  }

  const now = new Date().toISOString();
  const pricelist: Pricelist = {
    id: uuidv4(),
    name: data.name,
    type: data.type as Pricelist['type'],
    customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
    projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const service = getPriceService();
    const created = await service.createPricelist(pricelist);
    return jsonResponse(created, 201);
  } catch (err) {
    console.error('Unexpected error in POST /api/prices/pricelists:', err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
