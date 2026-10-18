// Chặn mọi màu đen trong CSS đầu ra (kể cả CSS thư viện) -> xanh rêu thương hiệu.
// Dùng đường dẫn tuyệt đối (theo thư mục dự án) vì Turbopack không phân giải plugin theo đường dẫn tương đối.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [`${process.cwd().split("\\").join("/")}/postcss-brand-colors.cjs`]: {},
  },
};

export default config;
