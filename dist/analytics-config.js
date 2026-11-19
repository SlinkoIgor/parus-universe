'use strict';
// Public Umami website ID, not a credential. Local/offline games do not report.
globalThis.PARUS_ANALYTICS_CONFIG = {
  enabled: true,
  websiteId: '638df471-e15b-4dfb-914b-447083317254',
  endpoint: '/analytics/api/send',
  hosts: ['starsail.fly', 'parus.165.232.99.124.sslip.io'],
};
