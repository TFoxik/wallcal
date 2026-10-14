#!/bin/sh
# Throwaway Home Assistant for WallCal on http://localhost:8124, serving the freshly built card.
# Uses `hass` from PATH (install once: uv tool install --python 3.14 homeassistant==2026.10.0) or
# HASS_BIN. HA installs integration requirements into that environment on first start, so point
# HASS_BIN only at an install meant for this; set HASS_SKIP_PIP=1 to forbid it.
set -eu
cd "$(dirname "$0")/../.."
npm run build
mkdir -p dev/ha/config/www
cp dist/wallcal-card.js dev/ha/config/www/wallcal-card.js
exec "${HASS_BIN:-hass}" ${HASS_SKIP_PIP:+--skip-pip} -c dev/ha/config
