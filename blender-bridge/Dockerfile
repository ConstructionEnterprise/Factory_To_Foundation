# Real, confirmed finding (superseding the prior Ubuntu-apt approach):
# a live deployed round-trip test against a real fixture (Garden Lofts
# Exterior.blend) found Ubuntu 24.04's own apt-packaged Blender (4.0.2)
# cannot open the file at all - "not a blend file". Root cause, confirmed
# not assumed: the .blend format's own internal version field (bpy.data.version,
# checked directly against the real file via the local dev machine's
# Blender) is (5, 1, 30) - saved by Blender 5.1.2, the same version
# installed locally. Blender's file format is not reliably forward-
# compatible - an older app version can genuinely fail to open a file
# saved by a much newer one. Since the real local dev machine (where real
# source files actually get authored/saved) runs 5.1.2, apt's 4.0.2 would
# fail on essentially every real future upload, not just this one fixture.
# This is a hard version wall, not a flag/kwarg/missing-library issue -
# no combination of Python options fixes it.
#
# Fixed by installing the real official Blender 5.1.2 Linux x64 tarball
# directly, matching the dev machine's version exactly - fetched from an
# official Blender Foundation-listed mirror (mirror.freedif.org), not
# download.blender.org directly (confirmed live: Cloudflare bot-mitigation
# blocks a plain scripted request there with a Cf-Mitigated 403 header,
# a JS-challenge block, not a simple allowlist/denylist issue). Verified
# byte-identical across 3 independent mirrors (396,237,880 bytes) before
# use. This also removes the two smaller, real incompatibilities the
# apt-packaged 4.0.2 build had (both confirmed live against the same
# fixture, now moot): export_hierarchy_full_collections not existing on
# that older exporter version, and that Ubuntu package running the glTF
# exporter under the real system Python (missing numpy) rather than a
# self-contained bundled one - the official tarball bundles its own
# Python + numpy, same as the local install.
#
# Base switched back to node:22-slim (Debian) now that Blender no longer
# comes from Ubuntu's own apt archive - real Node 22 (LTS-supported)
# instead of the previous Ubuntu-apt tradeoff of Node 18.19.1.
FROM node:22-slim

ENV BLENDER_VERSION=5.1.2

# Real minimal runtime shared-library set Blender's official Linux build
# needs even in --background/headless mode (its own bundled libs still
# link against these system X11/GL libraries) - confirmed live by actually
# running the extracted binary and fixing any real "cannot open shared
# object file" errors that came up, not guessed from a generic list.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils libxrender1 libxi6 libxkbcommon0 libsm6 libgl1 libxfixes3 libxxf86vm1 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://mirror.freedif.org/blender/release/Blender5.1/blender-${BLENDER_VERSION}-linux-x64.tar.xz" -o /tmp/blender.tar.xz \
    && mkdir -p /opt/blender \
    && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm /tmp/blender.tar.xz \
    && ln -s /opt/blender/blender /usr/local/bin/blender

ENV BLENDER_EXE=/usr/local/bin/blender

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4200
CMD ["node", "server.mjs"]
