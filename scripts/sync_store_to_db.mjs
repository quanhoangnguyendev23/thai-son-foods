import { Pool } from 'pg';
import { products, categories } from '../src/data/products.js';
import { combos } from '../src/data/combos.js';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

// If running directly with ts/mjs, let's dynamically import or read from json/ts
// To ensure 100% compatibility with Node without ts-node, let's read and parse or write clean standalone script
