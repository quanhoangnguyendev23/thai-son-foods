-- Loại combo cho trang admin (19/11/2026). Chỉ thêm cột + gán loại cho 12 combo theo bảng tính giá; không xoá gì.
-- Giống dòng ALTER trong src/lib/db.ts (runInitDatabase). Chạy lại nhiều lần không sao (IF NOT EXISTS, chỉ gán khi còn NULL).
BEGIN;
ALTER TABLE combos ADD COLUMN IF NOT EXISTS combo_type VARCHAR(20);
UPDATE combos SET combo_type = 'DA_DANG'
 WHERE combo_type IS NULL AND slug IN ('bo-san-pham-sua-hat', 'bo-3-loai-nuoc-mat-thanh-nhiet', 'thuong-thuc-combo-tra-sua');
UPDATE combos SET combo_type = 'CHI_DINH'
 WHERE combo_type IS NULL AND slug IN ('combo-chi-dinh-tao-do', 'combo-chi-dinh-nha-dam', 'combo-chi-dinh-matcha-ciao');
UPDATE combos SET combo_type = 'TANG_SO_LUONG'
 WHERE combo_type IS NULL AND slug IN ('combo-tang-so-luong-1', 'combo-tang-so-luong-2', 'combo-tang-so-luong-3');
UPDATE combos SET combo_type = 'GIA'
 WHERE combo_type IS NULL AND slug IN ('bo-san-pham-gia-dinh', 'bo-san-pham-ciao', 'bo-san-pham-03-dong');
COMMIT;
