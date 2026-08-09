import { findCultivarById, matchCultivar } from './cultivars';
import { findRegion } from './regions';
import { resolveTea, type TeaResolution } from './index';
import type { Cultivar, Region } from './types';

export interface TeaLineageProduct {
  name: string;
  chineseName?: string | null;
  origin?: string | null;
  cultivar?: string | null;
}

export interface TeaLineageResolution {
  cultivar: Cultivar | null;
  region: Region | null;
}

export interface TeaReferenceProduct extends TeaLineageProduct {
  variant?: string | null;
  type?: string | null;
  year?: number | string | null;
}

export function resolveLineage(product: TeaLineageProduct): TeaLineageResolution {
  const cultivar = product.cultivar
    ? findCultivarById(product.cultivar) ?? matchCultivar(product.cultivar)
    : matchCultivar(product.name, product.chineseName);
  const region = findRegion(product.origin);
  return { cultivar, region };
}

export function resolveRecord(product: TeaReferenceProduct): TeaResolution {
  return resolveTea({
    names: [product.variant, product.name, product.chineseName],
    known: { type: product.type, region: product.origin, year: product.year },
  });
}
