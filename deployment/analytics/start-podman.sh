#!/bin/sh
set -eu
PATH="$PWD/node_modules/.bin:$PATH"
export PATH
node scripts/check-db.js
node scripts/update-tracker.js
# The upstream start script forces 0.0.0.0. Host networking must stay private.
export HOSTNAME=127.0.0.1
exec node server.js
