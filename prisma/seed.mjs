import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { id: 'cat-sua-hat', slug: 'sua-hat', name: 'Sữa Hạt' },
  { id: 'cat-tra-sua', slug: 'tra-sua', name: 'Trà Sữa' },
  { id: 'cat-nuoc-giai-khat', slug: 'nuoc-giai-khat', name: 'Nước Giải Khát' },
];

const products = [
  {
    slug: 'sua-bap-nep-thai-son',
    name: 'Sữa Bắp Nếp Thái Sơn',
    sku: 'SB',
    shortDescription: 'Sữa bắp nếp thơm ngon, bổ dưỡng từ nguyên liệu bắp nếp chọn lọc.',
    description: 'Sữa Bắp Nếp Thái Sơn được chế biến từ nguồn nguyên liệu bắp nếp tươi ngon, được chọn lọc kỹ lưỡng, mang đến hương vị thơm ngọt tự nhiên, bổ dưỡng cho cả gia đình. Sản phẩm không sử dụng chất bảo quản, an toàn cho sức khỏe.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'sua-hat',
    thumbnail: '/images/products/sua-bap-nep.png',
    isFeatured: true,
    isNew: false,
    isBestSeller: true,
    variants: [
      { name: '1 chai', quantity: 1, price: 18000, unit: 'chai' },
      { name: '6 chai', quantity: 6, price: 108000, unit: 'lốc' },
      { name: '12 chai', quantity: 12, price: 216000, unit: 'thùng' },
      { name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
    ],
  },
  {
    slug: 'tao-do-hat-chia-thai-son',
    name: 'Táo Đỏ Hạt Chia Thái Sơn',
    sku: 'TD',
    shortDescription: 'Nước táo đỏ hạt chia bổ dưỡng, giàu chất xơ và vitamin.',
    description: 'Táo Đỏ Hạt Chia Thái Sơn kết hợp tinh hoa từ táo đỏ và hạt chia, mang đến thức uống giàu dinh dưỡng, bổ sung chất xơ và vitamin cho cơ thể.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'nuoc-giai-khat',
    thumbnail: '/images/products/tao-do-hat-chia.png',
    isFeatured: true,
    isNew: true,
    isBestSeller: false,
  },
  {
    slug: 'sua-hat-sen-lotus-yoo',
    name: 'Sữa Hạt Sen Lotus Yoo',
    sku: 'SS',
    shortDescription: 'Sữa hạt sen Lotus Yoo thanh mát, bổ dưỡng.',
    description: 'Sữa Hạt Sen Lotus Yoo được chiết xuất từ hạt sen tươi, mang đến hương vị thanh mát, nhẹ nhàng. Sản phẩm giàu dinh dưỡng, thích hợp cho mọi lứa tuổi.',
    price: 28000,
    unit: '1 chai',
    categorySlug: 'sua-hat',
    thumbnail: '/images/products/sua-hat-sen-lotus.png',
    isFeatured: true,
    isNew: false,
    isBestSeller: true,
  },
  {
    slug: 'sua-gao-lut-ohsawa-yoo',
    name: 'Sữa Gạo Lứt Ohsawa Yoo',
    sku: 'SL',
    shortDescription: 'Sữa gạo lứt Ohsawa Yoo thơm ngon, giàu dinh dưỡng.',
    description: 'Sữa Gạo Lứt Ohsawa Yoo được chế biến từ gạo lứt nguyên cám, giữ trọn vẹn dinh dưỡng tự nhiên.',
    price: 28000,
    unit: '1 chai',
    categorySlug: 'sua-hat',
    thumbnail: '/images/products/sua-gao-lut-ohsawa.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
  {
    slug: 'sam-la-han-hoa-cuc-thai-son',
    name: 'Sâm La Hán Hoa Cúc Thái Sơn',
    sku: 'LH',
    shortDescription: 'Nước sâm la hán hoa cúc thanh nhiệt, giải độc.',
    description: 'Sâm La Hán Hoa Cúc Thái Sơn kết hợp la hán quả và hoa cúc, tạo nên thức uống thanh nhiệt, giải độc, mát gan.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'nuoc-giai-khat',
    thumbnail: '/images/products/la-han.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
  {
    slug: 'nha-dam-mu-trom-thai-son',
    name: 'Nha Đam Mủ Trôm Thái Sơn',
    sku: 'MD',
    shortDescription: 'Nước nha đam mủ trôm mát lành, tốt cho tiêu hóa.',
    description: 'Nha Đam Mủ Trôm Thái Sơn kết hợp nha đam tươi và mủ trôm, mang đến thức uống mát lành, hỗ trợ tiêu hóa tốt.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'nuoc-giai-khat',
    thumbnail: '/images/products/mu-trom.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: true,
  },
  {
    slug: 'matcha-tra-sua-ciao',
    name: 'Matcha Trà Sữa Ciao',
    sku: 'MAC',
    shortDescription: 'Matcha trà sữa Ciao đậm đà, thơm ngon.',
    description: 'Matcha Trà Sữa Ciao mang đến hương vị matcha đậm đà kết hợp trà sữa béo ngậy. Thức uống thời thượng, phù hợp cho giới trẻ năng động.',
    price: 20000,
    unit: '1 chai',
    categorySlug: 'tra-sua',
    thumbnail: '/images/products/matcha-tra-sua-ciao.png',
    isFeatured: false,
    isNew: true,
    isBestSeller: false,
  },
  {
    slug: 'tra-xanh-go',
    name: 'Trà Xanh GO',
    sku: 'TXG',
    shortDescription: 'Trà xanh GO thanh mát, tự nhiên.',
    description: 'Trà Xanh GO được chế biến từ lá trà xanh tươi, giữ nguyên hương vị thanh mát tự nhiên.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'tra-sua',
    thumbnail: '/images/products/tra-xanh-go.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
  {
    slug: 'sua-gao-lut-mekong-xanh',
    name: 'Sữa Gạo Lứt Mekong Xanh',
    sku: 'SGL',
    shortDescription: 'Sữa gạo lứt Mekong Xanh từ đồng bằng sông Cửu Long.',
    description: 'Sữa Gạo Lứt Mekong Xanh được làm từ gạo lứt vùng đồng bằng sông Cửu Long, mang hương vị đặc trưng.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'sua-hat',
    thumbnail: '/images/products/sua-gao-lut-mekong.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
  {
    slug: 'tra-sua-ciao',
    name: 'Trà Sữa Ciao',
    sku: 'TSA',
    shortDescription: 'Trà sữa Ciao béo ngậy, thơm ngon.',
    description: 'Trà Sữa Ciao mang đến hương vị trà sữa đậm đà, béo ngậy. Sản phẩm được yêu thích bởi giới trẻ.',
    price: 20000,
    unit: '1 chai',
    categorySlug: 'tra-sua',
    thumbnail: '/images/products/tra-sua-ciao.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
  {
    slug: 'sua-hat-sen-mekong-xanh',
    name: 'Sữa Hạt Sen Mekong Xanh',
    sku: 'SHS',
    shortDescription: 'Sữa hạt sen Mekong Xanh thanh mát, bổ dưỡng.',
    description: 'Sữa Hạt Sen Mekong Xanh được chiết xuất từ hạt sen vùng Đồng Tháp, mang đến hương vị thanh nhẹ.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'sua-hat',
    thumbnail: '/images/products/sua-hat-sen-mekong.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
  {
    slug: 'tra-sua-go',
    name: 'Trà Sữa GO',
    sku: 'TSG',
    shortDescription: 'Trà sữa GO tiện lợi, đậm vị.',
    description: 'Trà Sữa GO mang đến hương vị trà sữa đặc trưng, tiện lợi sử dụng mọi lúc mọi nơi.',
    price: 18000,
    unit: '1 chai',
    categorySlug: 'tra-sua',
    thumbnail: '/images/products/tra-sua-go.png',
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
  },
];

async function main() {
  console.log('Seeding categories...');
  const categoryMap = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { slug: cat.slug, name: cat.name },
    });
    categoryMap[cat.slug] = created.id;
  }

  console.log('Seeding products...');
  for (const prod of products) {
    const { variants, categorySlug, ...prodData } = prod;
    const categoryId = categoryMap[categorySlug];

    const createdProduct = await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        ...prodData,
        categoryId,
      },
      create: {
        ...prodData,
        categoryId,
      },
    });

    if (variants && variants.length > 0) {
      await prisma.productVariant.deleteMany({ where: { productId: createdProduct.id } });
      for (const v of variants) {
        await prisma.productVariant.create({
          data: {
            name: v.name,
            quantity: v.quantity,
            price: v.price,
            unit: v.unit,
            productId: createdProduct.id,
          },
        });
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
