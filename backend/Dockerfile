# ----------------------------
# 1. Chọn image Node chính thức
# ----------------------------
# Node 22 mới nhất (alpine: nhẹ)
FROM node:22-alpine

# ----------------------------
# 2. Thiết lập thư mục làm việc trong container
# ----------------------------
WORKDIR /app

# ----------------------------
# 3. Copy file package.json & package-lock.json để cài dependencies
# ----------------------------
COPY package*.json ./

# ----------------------------
# 4. Cài đặt dependencies production
# ----------------------------
RUN npm ci --only=production

# ----------------------------
# 5. Copy toàn bộ source code vào container
# ----------------------------
COPY . .

# ----------------------------
# 6. Cấu hình môi trường
# ----------------------------
ENV PORT=3000
EXPOSE 3000

# ----------------------------
# 7. Command để chạy backend
# Nếu Node thuần
# ----------------------------
CMD ["npm", "start"]

# Nếu dùng TypeScript, uncomment dòng dưới:
# RUN npm run build
# CMD ["node", "dist/index.js"]
