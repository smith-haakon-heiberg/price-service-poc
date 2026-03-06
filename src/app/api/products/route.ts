import { NextRequest } from 'next/server';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';
import type { ProductFilter } from '@/domain/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const filter: ProductFilter = {};

  const categoryId = searchParams.get('categoryId');
  if (categoryId) filter.categoryId = categoryId;

  const warehouseId = searchParams.get('warehouseId');
  if (warehouseId) filter.warehouseId = warehouseId;

  const brand = searchParams.get('brand');
  if (brand) filter.brand = brand;

  const outletOnly = searchParams.get('outletOnly');
  if (outletOnly !== null) filter.outletOnly = outletOnly === 'true';

  const search = searchParams.get('search');
  if (search) filter.search = search;

  const limitParam = searchParams.get('limit');
  if (limitParam !== null) {
    const limit = parseInt(limitParam, 10);
    if (!isNaN(limit) && limit > 0) filter.limit = limit;
  }

  const offsetParam = searchParams.get('offset');
  if (offsetParam !== null) {
    const offset = parseInt(offsetParam, 10);
    if (!isNaN(offset) && offset >= 0) filter.offset = offset;
  }

  try {
    const service = getPriceService();
    const products = await service.listProducts(filter);
    return jsonResponse(products);
  } catch (err) {
    console.error('Unexpected error in GET /api/products:', err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
