#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) -eq 0 ]] || { echo 'Run as root' >&2; exit 1; }
. /etc/os-release
[[ "$ID" = amzn && $(uname -m) = x86_64 ]] || { echo 'This bootstrap is for Amazon Linux x86_64' >&2; exit 1; }
dnf install -y nodejs24 nodejs24-npm tar gzip xz jq dejavu-sans-fonts
if ! command -v node >/dev/null; then ln -s /usr/bin/node-24 /usr/local/bin/node; fi
if ! command -v npm >/dev/null; then ln -s /usr/bin/npm-24 /usr/local/bin/npm; fi
id msapp >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/marketing-studio/home --shell /sbin/nologin msapp
id caddy >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/caddy --shell /sbin/nologin caddy
install -d -m 755 /opt/marketing-studio/releases /opt/marketing-studio/incoming /etc/caddy
install -d -o root -g msapp -m 750 /opt/marketing-studio/shared
install -d -o msapp -g msapp -m 700 /opt/marketing-studio/shared/data
install -d -o caddy -g caddy -m 750 /var/lib/caddy
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl -fsSL --retry 3 'https://github.com/caddyserver/caddy/releases/download/v2.11.4/caddy_2.11.4_linux_amd64.tar.gz' -o "$work/caddy.tar.gz"
printf '%s  %s\n' '527fbf917c39189a1e3b31d34fa955601680b2d5c8055d2a87b8b9588dec7bb9' "$work/caddy.tar.gz" | sha256sum -c -
tar -xzf "$work/caddy.tar.gz" -C "$work" caddy
install -m 755 "$work/caddy" /usr/local/bin/caddy
curl -fsSL --retry 3 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-14-13-17/ffmpeg-n8.1.2-52-g5a03dfa0f6-linux64-gpl-8.1.tar.xz' -o "$work/ffmpeg.tar.xz"
printf '%s  %s\n' '0a0c3002405807439bf558fab62f70ba4c958ff1fef8cb2676be75a9aab2e0b4' "$work/ffmpeg.tar.xz" | sha256sum -c -
tar -xJf "$work/ffmpeg.tar.xz" -C "$work"
install -m 755 "$work"/ffmpeg-*/bin/ffmpeg /usr/local/bin/ffmpeg
install -m 755 "$work"/ffmpeg-*/bin/ffprobe /usr/local/bin/ffprobe
if [[ -z $(swapon --noheadings --show) && ! -e /swapfile ]]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-marketing-studio.conf
sysctl -p /etc/sysctl.d/90-marketing-studio.conf
node --version
npm --version
/usr/local/bin/caddy version
/usr/local/bin/ffmpeg -version | head -1
/usr/local/bin/ffprobe -version | head -1
