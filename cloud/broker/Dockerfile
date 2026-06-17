FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY test ./test
COPY workspace ./workspace

ENV COCO_WORKSPACE=/app/workspace
CMD ["node", "src/cli.js", "heartbeat"]
