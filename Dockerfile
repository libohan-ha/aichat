FROM node:20-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY pnpm-lock.yaml ./

# 安装pnpm并安装依赖
RUN npm install -g pnpm && pnpm install

# 复制源代码
COPY . .

# 创建uploads目录并设置权限
RUN mkdir -p /app/public/uploads && chmod 777 /app/public/uploads

# 设置Prisma环境变量，忽略校验问题
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# 生成Prisma客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3005

# 启动脚本：先迁移数据库，再启动应用
CMD ["sh", "-c", "npx prisma db push && npm start"]