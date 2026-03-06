import { NextRequest } from 'next/server';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';
import { PriceServiceError } from '@/application/price-service';
import type { PriceContext, CustomerType, MembershipTier } from '@/domain/types';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 'INVALID_BODY', 400);
  }

  const data = body as Record<string, unknown>;

  if (!data.sku || typeof data.sku !== 'string') {
    return errorResponse('Missing required field: sku', 'MISSING_FIELD', 400);
  }
  if (!data.customerType || typeof data.customerType !== 'string') {
    return errorResponse('Missing required field: customerType', 'MISSING_FIELD', 400);
  }

  const context: PriceContext = {
    sku: data.sku,
    customerType: data.customerType as CustomerType,
    customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
    membershipTier: typeof data.membershipTier === 'string' ? (data.membershipTier as MembershipTier) : undefined,
    projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
    quantity: typeof data.quantity === 'number' ? data.quantity : 1,
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : undefined,
    date: typeof data.date === 'string' ? data.date : new Date().toISOString().split('T')[0]!,
  };

  try {
    const service = getPriceService();
    const result = await service.calculatePrice(context);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof PriceServiceError) {
      if (err.code === 'PRODUCT_NOT_FOUND') {
        return errorResponse(err.message, err.code, 404);
      }
      return errorResponse(err.message, err.code, 400);
    }
    console.error('Unexpected error in POST /api/prices/calculate:', err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
