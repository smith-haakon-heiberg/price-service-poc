import { NextRequest } from 'next/server';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';
import { PriceServiceError } from '@/application/price-service';
import type { PriceContext, CustomerType, MembershipTier } from '@/domain/types';

type RouteContext = { params: Promise<{ sku: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { sku } = await params;
  const { searchParams } = request.nextUrl;

  const customerType = searchParams.get('customerType');
  if (!customerType) {
    return errorResponse('Missing required query param: customerType', 'MISSING_FIELD', 400);
  }

  const context: PriceContext = {
    sku,
    customerType: customerType as CustomerType,
    customerId: searchParams.get('customerId') ?? undefined,
    membershipTier: (searchParams.get('membershipTier') ?? undefined) as MembershipTier | undefined,
    projectId: searchParams.get('projectId') ?? undefined,
    quantity: (() => {
      const q = searchParams.get('quantity');
      if (q === null) return 1;
      const parsed = parseInt(q, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    })(),
    warehouseId: searchParams.get('warehouseId') ?? undefined,
    date: searchParams.get('date') ?? new Date().toISOString().split('T')[0]!,
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
    console.error(`Unexpected error in GET /api/prices/explain/${sku}:`, err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
