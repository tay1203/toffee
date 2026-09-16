const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests', testMatch: '**/*.spec.cjs', timeout: 45000, workers: 1, reporter: 'list', use: { trace: 'retain-on-failure' }, webServer: { command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false } });
