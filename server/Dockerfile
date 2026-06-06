# dmosh heavy-mode server. ffmpeg is required; FFglitch (ffgac/ffedit) is
# optional and only needed for the `motionTransfer` effect — see README.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The server imports the shared pure engine from ../src/mosh, so copy both.
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY src ./src
COPY server ./server

ENV PORT=8787
EXPOSE 8787
WORKDIR /app/server
CMD ["npm", "start"]
