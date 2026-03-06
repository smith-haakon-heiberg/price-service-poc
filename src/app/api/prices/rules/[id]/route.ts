import { NextRequest } from 'next/server';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';
import { PriceServiceError } from '@/application/price-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const service = getPriceService();
    const rule = await service.getRule(id);
    if (!rule) {
      return errorResponse(`Rule not found: ${id}`, 'NOT_FOUND', 404);
    }
    return jsonResponse(rule);
  } catch (err) {
    console.error(`Unexpected error in GET /api/prices/rules/${id}:`, err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 'INVALID_BODY', 400);
  }

  const updates = body as Record<string, unknown>;

  // Strip immutable fields if caller inadvertently included them
  delete updates['id'];
  delete updates['createdAt'];

  updates['updatedAt'] = new Date().toISOString();

  try {
    const service = getPriceService();
    const updated = await service.updateRule(id, updates);
    return jsonResponse(updated);
  } catch (err) {
    if (err instanceof PriceServiceError) {
      return errorResponse(err.message, err.code, 400);
    }
    if (err instanceof Error && err.message.includes('not found')) {
      return errorResponse(`Rule not found: ${id}`, 'NOT_FOUND', 404);
    }
    console.error(`Unexpected error in PUT /api/prices/rules/${id}:`, err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const service = getPriceService();
    await service.deleteRule(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return errorResponse(`Rule not found: ${id}`, 'NOT_FOUND', 404);
    }
    console.error(`Unexpected error in DELETE /api/prices/rules/${id}:`, err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
