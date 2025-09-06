module.exports = {
  apps: [
    {
      name: "kusystem-backend",
      cwd: __dirname,
      script: "node",
      args: "./node_modules/tsx/dist/cli.mjs watch src/server.ts",
      interpreter: "none",
      windowsHide: true,
      autorestart: true,
      restart_delay: 3000,
      env: { NODE_ENV: "development" }
    }
  ]
}
