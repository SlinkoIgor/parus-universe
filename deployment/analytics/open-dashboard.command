#!/bin/zsh
set -euo pipefail
# Uses the existing SSH key. This file contains no password or private key.
if ! /usr/bin/curl -fsS --max-time 2 http://127.0.0.1:3100/api/heartbeat >/dev/null 2>&1; then
  /usr/bin/ssh -fN -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
    -L 127.0.0.1:3100:127.0.0.1:3100 root@165.232.99.124
fi
/usr/bin/ssh root@165.232.99.124 \
  "sed -n 's/^UMAMI_ADMIN_PASSWORD=//p' /srv/parus/analytics/.env" | /usr/bin/pbcopy
/usr/bin/open http://127.0.0.1:3100
print 'Логин: admin. Пароль скопирован — вставьте его в поле пароля.'
