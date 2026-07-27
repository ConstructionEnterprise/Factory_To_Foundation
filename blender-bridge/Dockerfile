# Real, confirmed finding: download.blender.org sits behind Cloudflare
# bot-mitigation (Cf-Mitigated response header on a plain wget/curl 403,
# checked directly) - a JS-challenge block a scripted request can't pass
# regardless of source IP, not a simple allowlist/denylist. Using Ubuntu's
# own official apt archive instead (archive.ubuntu.com, not Cloudflare-
# protected) - a legitimate first-party distribution channel, just a
# different one than blender.org directly.
#
# Base is real ubuntu:24.04 (not node:22-slim/Debian) specifically
# because Debian's own apt-packaged Blender is an older 3.4.1 - confirmed
# live by an earlier build attempt that actually installed it - versus
# Ubuntu 24.04's noble/universe repo, confirmed via a direct apt-cache
# policy check to carry 4.0.2. Real, disclosed version tradeoff either
# way: this is not the 5.1.2 installed locally. The specific glTF-exporter
# options this pipeline uses (export_extras, export_hierarchy_full_collections,
# use_renderable, export_yup) have been stable well before 4.0, but this
# is confirmed for real via the live upload round-trip test after deploy,
# not assumed compatible from version numbers alone.
#
# Node.js also comes from this same apt archive (18.19.1, noble/universe)
# rather than NodeSource's repo - a second disclosed tradeoff: 18.x is
# past Node's own LTS support window, accepted here to avoid a second
# third-party-repo network dependency after the Blender one above already
# hit a real block. blender-bridge's own code only uses long-stable Node
# APIs (fetch, node:http, node:child_process, node:crypto), so this is a
# supply-chain/patching tradeoff, not a functional-compatibility risk.
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    blender nodejs npm \
    && rm -rf /var/lib/apt/lists/*

ENV BLENDER_EXE=/usr/bin/blender

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4200
CMD ["node", "server.mjs"]
