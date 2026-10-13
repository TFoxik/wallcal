#!/bin/sh
# Throwaway Home Assistant for WallCal on http://localhost:8124, serving the freshly built card.
# HASS_BIN points at any installed `hass`; --skip-pip keeps HA from installing into that environment.
set -eu
cd "$(dirname "$0")/../.."
npm run build
mkdir -p dev/ha/config/www
cp dist/wallcal-card.js dev/ha/config/www/wallcal-card.js
exec "${HASS_BIN:-hass}" --skip-pip -c dev/ha/config
