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

  if (!Array.isArray(data.items)) {
    return errorResponse('Missing required field: items (must be an array)', 'MISSING_FIELD', 400);
  }

  const items: PriceContext[] = (data.items as Record<string, unknown>[]).map((item) => ({
    sku: typeof item.sku === 'string' ? item.sku : '',
    customerType: (typeof item.customerType === 'string' ? item.customerType : '') as CustomerType,
    customerId: typeof item.customerId === 'string' ? item.customerId : undefined,
    membershipTier: typeof item.membershipTier === 'string' ? (item.membershipTier as MembershipTier) : undefined,
    projectId: typeof item.projectId === 'string' ? item.projectId : undefined,
    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    warehouseId: typeof item.warehouseId === 'string' ? item.warehouseId : undefined,
    date: typeof item.date === 'string' ? item.date : new Date().toISOString().split('T')[0]!,
  }));

  const service = getPriceService();

  const results = await Promise.all(
    items.map(async (ctx) => {
      try {
        return await service.calculatePrice(ctx);
      } catch (err) {
        if (err instanceof PriceServiceError) {
          return { error: { message: err.message, code: err.code }, sku: ctx.sku };
        }
        return { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }, sku: ctx.sku };
      }
    })
  );

  return jsonResponse({ results });
}
