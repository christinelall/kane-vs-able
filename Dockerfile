FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget gnupg fonts-liberation \
  && mkdir -p /etc/apt/keyrings \
  && wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/keyrings/google-chrome.gpg \
  && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @testmuai/kane-cli @openai/codex

WORKDIR /app
COPY . .
RUN chmod +x scripts/docker-entrypoint.sh \
  && chown -R node:node /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    KANE_HEADLESS=1

USER node

EXPOSE 4173
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
CMD ["npm", "start"]
