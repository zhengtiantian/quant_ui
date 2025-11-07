# ========== 构建阶段 ==========
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install

# 复制项目代码并构建
COPY . .
RUN npm run build

# ========== 运行阶段 ==========
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# 删除默认文件并复制打包结果
RUN rm -rf ./*
COPY --from=builder /app/dist .

# 替换默认 Nginx 配置（支持前端路由）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]