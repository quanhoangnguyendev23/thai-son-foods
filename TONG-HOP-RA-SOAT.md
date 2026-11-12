# Tá»•ng há»£p rÃ  soÃ¡t logic vÃ  bá»™ test (11/11 Ä‘áº¿n 12/11/2026)

NhÃ¡nh `chore/cleanup`, chÆ°a push. Chi tiáº¿t tá»«ng má»¥c (file:dÃ²ng, cÃ¡ch tÃ¡i hiá»‡n, Ä‘á» xuáº¥t) náº±m trong `REVIEW.md`. File nÃ y chá»‰ tÃ³m táº¯t tráº¡ng thÃ¡i.

## 1. Káº¿t quáº£ hiá»‡n táº¡i

- **Bá»™ test:** `node:test` cháº¡y báº±ng `npx tsx --test`, khÃ´ng cÃ i thÃªm thÆ° viá»‡n. 15 file `tests/*.test.mjs`.
- **Láº§n cháº¡y cuá»‘i:** 212 test, 198 Ä‘áº¡t, 11 fail, 3 todo. Äá»™ phá»§ 80,09% dÃ²ng, 67,04% nhÃ¡nh, 51,15% hÃ m (chá»‰ tÃ­nh file Ä‘Æ°á»£c náº¡p).
- **11 fail Ä‘á»u lÃ  lá»—i tháº­t chÆ°a sá»­a** (cá»‘ Ã½ Ä‘á»ƒ fail, khÃ´ng ná»›i lá»ng test): R20, Lá»—i 6, R30, R31, R32, R34, R40 (2 test), R41 (2 test), R43.
- **3 todo chá» quyáº¿t Ä‘á»‹nh nghiá»‡p vá»¥:** R8, R25, R33.
- Test tÃ­ch há»£p cháº¡y trÃªn DB riÃªng `webtsf_review_test` (PostgreSQL local), khÃ´ng Ä‘á»¥ng `WebTSF` vÃ  `WebTSF_staging` (chá»‰ SELECT khi cáº§n Ä‘á»c dá»¯ liá»‡u tháº­t). ChÆ°a cháº¡y script nÃ o vá»›i `--apply`.

## 2. ÄÃ£ sá»­a (má»—i má»¥c má»™t commit)

| Má»¥c | Ná»™i dung | Commit |
|---|---|---|
| R1 | Má»™t hÃ m chuáº©n hÃ³a SÄT cho kiá»ƒm tra, lÆ°u vÃ  so khá»›p (kÃ¨m `scripts/normalize_order_phones.mjs`, chÆ°a cháº¡y) | `6af2d4c` |
| R2 | Chá»‘ng spam theo SÄT cháº¡y trong giao dá»‹ch, sau khÃ³a tÆ° váº¥n theo SÄT | `a2a7dcc` |
| R3 | Äá»‹a chá»‰ chi nhÃ¡nh luÃ´n láº¥y tá»« DB | `6aa712c` |
| R4 | Giá» hÃ ng khÃ´ng ghi NaN vÃ o sá»‘ lÆ°á»£ng | `6a7091f` |
| R5 | NÃºt HoÃ n tÃ¡c tÃ¬m dÃ²ng theo khÃ³a gá»™p (`undoAdd`) | `d6f58bc` |
| R6 | CÃ¢u bÃ¡o lá»—i ngoÃ i bÃ¡n kÃ­nh lÃ m trÃ²n lÃªn 0,1 km | `b8de342` |
| R7 | `formatShortVND` khÃ´ng hiá»‡n "1000K" | `63f0e43` |
| R9 | XÃ³a hÃ m phÃ­ ship cÅ©, test dÃ¹ng hÃ m tháº­t | `4a1d29d` |
| R10 | Ghi chÃº nhÃ¡nh `catch` dá»± phÃ²ng | `5da7591` |
| R11 | JSDoc Ä‘Ãºng hÃ m | `24bdf75` |
| R14 | Giá» cÅ© chia theo sá»‘ chai cá»§a lá»‘c nhá» nháº¥t | `eece46e` |
| R15 | `confirmStock` khÃ³a dÃ²ng tá»“n kho, Ä‘Ã£ kiá»ƒm tra thá»© tá»± khÃ³a, khÃ´ng deadlock | `2ab8f58` |
| R16 | Giá» nháº­n dáº¡ng mÃ£ quy cÃ¡ch `-loc5` | `222f44f` |
| R17 | HoÃ n hÃ ng nháº­p kho theo reservation Ä‘Ã£ confirmed | `43829a4` |
| R18 | Tá»± há»§y Ä‘Æ¡n quÃ¡ háº¡n thÃ¬ há»§y luÃ´n hoa há»“ng Æ°á»›c tÃ­nh | `32fb2b9` |
| R19 | Sá»± kiá»‡n hoa há»“ng idempotent, bá» láº§n gá»i trÃ¹ng á»Ÿ PUT admin | `2e97d7c` |
| R21 | Há»§y Ä‘Æ¡n Ä‘Ã£ trá»« kho ghi nháº­t kÃ½ tá»“n kho | `1ef70ca` |
| R22 | Hoa há»“ng Ä‘á»‘i tÃ¡c theo pháº§n trÄƒm, `??` thay `\|\|`, sá»­a lá»—i khÃ³a ngoáº¡i khi dÃ¹ng chÃ­nh sÃ¡ch dá»± phÃ²ng | `d17969c` |
| R23 | Chiáº¿t kháº¥u háº¡ng Ä‘áº¡i lÃ½ 0% khÃ´ng bá»‹ Ä‘á»•i thÃ nh 15% (cáº£ `dealer/products`) | `57c6dd2` |
| R24 | PUT combo vÃ  sáº£n pháº©m kiá»ƒm tra giÃ¡ vá»‘n; `null` vÃ  chuá»—i rá»—ng bá»‹ tá»« chá»‘i | `0de4783`, `48ef30e` |
| Tháº» sáº£n pháº©m | Sá»‘ lÆ°á»£ng trÃªn nÃºt Ä‘áº¿m theo khÃ³a gá»™p (`findCartLine`) | `caf26ef` |

## 3. ÄÃ£ rÃºt láº¡i hoáº·c háº¡ má»©c (em Ä‘Ã£ Ä‘Ã­nh chÃ­nh trong bÃ¡o cÃ¡o)

- **R6 (pháº§n Ä‘áº§u):** "20,04 km váº«n Ä‘Æ°á»£c giao" lÃ  sai; code tá»« chá»‘i Ä‘Ãºng.
- **R10:** khÃ´ng pháº£i mÃ£ cháº¿t, `catch` cÃ²n bao cáº£ lá»‡nh `import` Ä‘á»™ng; chá»‰ thÃªm ghi chÃº.
- **R12:** gáº¡ch bá» (`cost_price` lÃ  INTEGER, phÃ©p chia luÃ´n cháºµn).
- **R13:** háº¡ xuá»‘ng, khÃ´ng cÃ³ sáº£n pháº©m nÃ o mang chá»¯ "combo" trong id/slug/sku á»Ÿ hai DB local vÃ  dá»¯ liá»‡u tÄ©nh.
- **R15:** háº¡ xuá»‘ng Nháº¹; admin khÃ´ng sá»­a tay tá»“n kho xuá»‘ng dÆ°á»›i giá»¯ chá»— Ä‘Æ°á»£c.

## 4. ChÆ°a sá»­a, Ä‘ang chá» anh

**Cao khi báº­t tÃ­nh nÄƒng** (chÆ°Æ¡ng trÃ¬nh Ä‘á»‘i tÃ¡c, há»™i viÃªn, giao Ä‘á»‹nh ká»³ Ä‘ang táº¯t máº·c Ä‘á»‹nh):
- **R40** gá»­i OTP khÃ´ng giá»›i háº¡n táº§n suáº¥t, xÃ¡c minh OTP há»™i viÃªn Ä‘Äƒng nháº­p tháº³ng vÃ o tÃ i khoáº£n theo SÄT.
- **R41** `POST /api/membership/subscribe`: Ä‘iá»ƒm thÆ°á»Ÿng vÃ  dÃ¹ng thá»­ khÃ´ng giá»›i háº¡n, gÃ³i tráº£ phÃ­ khÃ´ng qua thanh toÃ¡n.
- **R43** hai Ä‘á»‹nh nghÄ©a trÃ¡i nhau cho báº£ng `loyalty_point_ledger`.
- **Lá»—i 6** (Ä‘Ã£ cÃ³ trong bÃ¡o cÃ¡o 10/11, báº£n sá»­a á»Ÿ nhÃ¡nh `fix/lo-hong-bao-mat`): rÃºt tiá»n vÆ°á»£t thá»i gian Ä‘á»‘i soÃ¡t. **R30:** sá»‘ dÆ° kháº£ dá»¥ng hiá»ƒn thá»‹ khÃ´ng trá»« khoáº£n Ä‘Ã£ rÃºt.
- **R32** cron sinh Ä‘Æ¡n Ä‘á»‹nh ká»³ khÃ´ng `ROLLBACK`, tráº£ káº¿t ná»‘i há»ng vá» pool. **R34** Ä‘Æ¡n Ä‘á»‹nh ká»³ táº¡o tá»« giao diá»‡n (mÃ£ `sub-*`) khÃ´ng xÃ¡c nháº­n Ä‘Æ°á»£c. **R31** cron tÃ­nh giÃ¡ má»™t chai cho cáº£ lá»‘c khi mÃ£ trÃ¹ng catalog.

**Trung bÃ¬nh:** R20 (thÃ nh pháº§n combo khÃ´ng nháº­n dáº¡ng Ä‘Æ°á»£c bá»‹ bá» qua), R28 (xÃ¡c nháº­n Ä‘Æ¡n thiáº¿u hÃ ng tráº£ 500 vÃ  cÃ¢u chung chung á»Ÿ production), R29 (`initDatabase` khÃ´ng dá»±ng Ä‘á»§ báº£ng/cá»™t: `inventory_logs`, `products.volume`), R35 (Ä‘á»‘i tÃ¡c yÃªu cáº§u nÃ¢ng cáº¥p Ä‘áº¡i lÃ½ bá»‹ máº¥t quyá»n rÃºt tiá»n).

**Nháº¹:** R8, R25 Ä‘áº¿n R27, R33, R36 Ä‘áº¿n R39, R42, R44.

## 5. Quyáº¿t Ä‘á»‹nh cáº§n anh tráº£ lá»i

1. **R8:** combo Ä‘Ã£ táº¡m dá»«ng cÃ²n trong giá» cÃ³ hiá»‡n tiáº¿t kiá»‡m khÃ´ng (a: khÃ´ng, sá»­a code; b: cÃ³, sá»­a comment).
2. **R20:** thÃ nh pháº§n combo khÃ´ng nháº­n dáº¡ng Ä‘Æ°á»£c thÃ¬ tá»« chá»‘i cáº£ Ä‘Æ¡n hay bá» qua thÃ nh pháº§n thiáº¿u.
3. **R25:** nhÃ¢n viÃªn cá»­a hÃ ng Ä‘Æ°á»£c Ã©p xuáº¥t kho thiáº¿u hÃ ng (`allowOversell`) khÃ´ng. Hiá»‡n khÃ´ng giao diá»‡n nÃ o gá»­i cá» nÃ y.
4. **R26, R27, R33:** R26 chuyá»ƒn chi nhÃ¡nh khÃ´ng láº¥y khÃ³a nhÆ° Ä‘áº·t Ä‘Æ¡n; R27 tá»“n áº£o 100 chai á»Ÿ nhÃ¡nh Ä‘Æ¡n cÅ©; R33 cron giá»¯ chá»— má»™t pháº§n khi thiáº¿u hÃ ng.
5. **Má»©c Ä‘Æ¡n tá»‘i thiá»ƒu cho hoa há»“ng** (`min_order_value` 50.000Ä‘ trong chÃ­nh sÃ¡ch): hiá»‡n chÆ°a Ã¡p.
6. **ÄÆ¡n trÃ¹ng khi báº¥m Ä‘Ãºp hoáº·c máº¥t máº¡ng:** khÃ³a idempotency cáº§n thÃªm cá»™t `idempotency_key` (UNIQUE) trong `orders`; hoáº·c chá»‰ thÃªm chá»‘t cháº·n á»Ÿ trÃ¬nh duyá»‡t vÃ  mÃ£ lá»—i 429 riÃªng.
7. **R6:** em chá»n lÃ m tround lÃªn 0,1 km; Ä‘á»•i sang 2 chá»¯ sá»‘ tháº­p phÃ¢n náº¿u anh muá»‘n.
8. **Test `canonicalProductId`:** `tests/inventory_pure.test.mjs` import hÃ m nÃ y, hiá»‡n chá»‰ cÃ³ trong thay Ä‘á»•i chÆ°a commit cá»§a thread khÃ¡c; bá» khá»i file hay chá» thread kia commit.
9. **Má»¥c nÃ o sá»­a tiáº¿p.** Äá» xuáº¥t theo thá»© tá»±: R40, R41, R32, Lá»—i 6 cÃ¹ng R30, R34, R28.

## 6. CÃ¡ch cháº¡y

Táº¡o DB test má»™t láº§n: `psql -U postgres -c "CREATE DATABASE webtsf_review_test"` (schema tá»± dá»±ng). KhÃ´ng dÃ¹ng glob `tests/*.test.mjs` vÃ¬ `store_recommender.test.mjs` TEST 3 Ä‘áº¿n 5 gá»i server cá»•ng 3000.

```bash
npx tsx --test --test-reporter=spec tests/shipping_fee.test.mjs tests/cart_store.test.mjs tests/cart_rehydrate.test.mjs tests/order_status_delivery.test.mjs tests/savings_utils.test.mjs tests/inventory_pure.test.mjs tests/validation_ratelimit.test.mjs tests/partner_config.test.mjs tests/orders_api_integration.test.mjs tests/inventory_confirm_concurrency.test.mjs tests/orders_lifecycle_integration.test.mjs tests/api_sessions_integration.test.mjs tests/money_routes_integration.test.mjs tests/membership_integration.test.mjs
```

CÃ¡c file test cháº¡m DB dÃ¹ng khÃ³a tÆ° váº¥n cá»§a PostgreSQL nÃªn tá»± xáº¿p hÃ ng khi cháº¡y song song. Äáº§u ra cá»§a láº§n cháº¡y cuá»‘i: `tests/last_unit_run_output.txt`.

## 7. Cáº§n biáº¿t

- MÃ¡y cÃ²n khoáº£ng 59 thay Ä‘á»•i chÆ°a commit cá»§a thread khÃ¡c (combo, trang sáº£n pháº©m). Má»i commit cá»§a em chá»‰ chá»©a dÃ²ng cá»§a em.
- Pháº§n chÆ°a Ä‘á»c ká»¹: `partner/profile`, `partner/orders`, `subscriptions/[id]/*`, `cron/.../reminders`, `admin/members`, `auth/register`, `auth/me`, `auth/callback/*`, `mock-oauth`, `user/*`, trang quáº£n trá»‹ vÃ  pháº§n lá»›n giao diá»‡n.
- CÃ¡c tá»‡p á»Ÿ thÆ° má»¥c dá»± Ã¡n: `REVIEW.md` (chi tiáº¿t), `tests/helpers/review_test_db.mjs` vÃ  `tests/helpers/review_test_session.mjs` (bá»™ dá»±ng DB vÃ  phiÃªn Ä‘Äƒng nháº­p giáº£).

