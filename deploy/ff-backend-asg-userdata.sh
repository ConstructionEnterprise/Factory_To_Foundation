#!/bin/bash
# Real bootstrap for FF backend Auto Scaling Group instances (AWS Phase 4
# HA build). Runs once at first boot on every instance the ASG launches -
# must be fully self-contained and idempotent-safe, since instances are
# ephemeral and can be replaced at any time by the ASG.
#
# Real cert-distribution model: these instances never run certbot
# themselves. One real Let's Encrypt cert for the NLB's own static
# Elastic-IP-derived sslip.io hostname is obtained once (via a real
# HTTP-01 challenge, run manually against a specific instance) and stored
# in S3 (private-config/cert/). Every instance - this one included -
# downloads whatever's currently in S3 at boot. If nothing's there yet
# (the very first launch, before any cert has ever been issued), this
# instance serves HTTP-only on port 80 so the ACME challenge that
# produces the first real cert can succeed through it.
set -euo pipefail

S3_BUCKET="construction-enterprise-project-files-027958788731-us-east-2-an"
APP_DIR=/opt/ff-deploy/ff-app
CERT_DIR=/etc/nginx/ff-certs
SSLIP_HOSTNAME="3-23-62-46.sslip.io"

apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx unzip

# Real fix, same lesson as blender-bridge's own Blender-tarball fix
# (CLAUDE.md §18) - Ubuntu 24.04's apt repos have no installable `awscli`
# candidate at all (confirmed live: "Package 'awscli' has no installation
# candidate"), not just a stale version. The official AWS-provided
# installer is the reliable path, not any Linux distro's own package
# archive.
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

mkdir -p "$APP_DIR" "$CERT_DIR"
cd "$APP_DIR"

aws s3 cp "s3://$S3_BUCKET/deploy-artifacts/ff-app.tar.gz" /tmp/ff-app.tar.gz
tar -xzf /tmp/ff-app.tar.gz -C "$APP_DIR"

# Real shared backend/.env (DATABASE_URL, JWT_SECRET, etc.) - must be
# byte-identical across every backend instance, since a session token
# issued by one instance has to validate on whichever instance a later
# request happens to land on.
aws s3 cp "s3://$S3_BUCKET/private-config/backend.env" "$APP_DIR/backend/.env"

mkdir -p /etc/nginx/sites-enabled
rm -f /etc/nginx/sites-enabled/default
aws s3 cp "s3://$S3_BUCKET/deploy-artifacts/ff-proxy-params.conf" /etc/nginx/ff-proxy-params.conf
aws s3 cp "s3://$S3_BUCKET/deploy-artifacts/ff-backend-asg-locations.conf" /etc/nginx/sites-available/ff-backend-asg-locations.conf
aws s3 cp "s3://$S3_BUCKET/deploy-artifacts/ff-backend-asg.nginx.conf" /etc/nginx/sites-available/ff-backend-asg
ln -sf /etc/nginx/sites-available/ff-backend-asg /etc/nginx/sites-enabled/ff-backend-asg

# Real, honest two-case cert handling - not simulated, not assumed.
if aws s3 cp "s3://$S3_BUCKET/private-config/cert/fullchain.pem" "$CERT_DIR/fullchain.pem" 2>/dev/null \
  && aws s3 cp "s3://$S3_BUCKET/private-config/cert/privkey.pem" "$CERT_DIR/privkey.pem" 2>/dev/null; then
  cat >> /etc/nginx/sites-available/ff-backend-asg << NGINXEOF

server {
    listen 443 ssl;
    server_name $SSLIP_HOSTNAME;
    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/nginx/sites-available/ff-backend-asg-locations.conf;
}
NGINXEOF
  echo "Real cert found in S3 - HTTPS configured."
else
  echo "No cert in S3 yet (expected on the very first launch before one has ever been issued) - HTTP-only for now."
fi

nginx -t
systemctl enable nginx
systemctl restart nginx

cd "$APP_DIR"
docker compose up -d --build backend
