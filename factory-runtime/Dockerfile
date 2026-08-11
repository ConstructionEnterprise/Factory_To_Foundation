# node:22-slim (Debian/glibc) + system Python3 for the separate driver
# process (twin_headless_driver.py, spawned as a child process - a
# completely different Python than anything Blender might use elsewhere).
# Copied from twin-bridge--DO-NOT-USE/Dockerfile (migration §7 step 4.3) —
# same shape, unchanged reasoning, only EXPOSE's port number differs.
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# --break-system-packages: this is a single-purpose container image, not
# a general Debian system - no risk of conflicting with a system Python
# tool that isn't installed here anyway.
RUN pip3 install --no-cache-dir --break-system-packages numpy matplotlib

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Construction_Enterprises is deliberately NOT baked into this image -
# see docker-compose.yml's volume mount. It's a separate, actively-
# evolving Python repo; mounting it from the host means it can be
# git-pulled/updated independently without rebuilding this image.
EXPOSE 4103
CMD ["node", "server.mjs"]
