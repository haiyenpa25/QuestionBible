module.exports = {
  apps: [
    {
      name: 'questionbible',
      script: 'server/dist/index.js',
      instances: 1, // 1 tiến trình là đủ cho vài nghìn người
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};

