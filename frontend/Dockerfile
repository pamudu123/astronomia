# Build from the repository root so the design images are available:
#   docker build -f frontend/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo
COPY design/assets/web ./design/assets/web
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
RUN cd frontend && npm run build

FROM node:22-slim
WORKDIR /srv
ENV NODE_ENV=production
COPY --from=build /repo/frontend ./
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--port", "3000"]
