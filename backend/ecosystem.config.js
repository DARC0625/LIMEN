module.exports = {
  apps: [
    {
      name: 'limen',
      script: './server',
      cwd: '/home/darc0/LIMEN/backend',
      instances: 1,
      exec_mode: 'fork',
      env_file: '/home/darc0/LIMEN/backend/.env',
      error_file: '/home/darc0/.pm2/logs/limen-backend-error.log',
      out_file: '/home/darc0/.pm2/logs/limen-backend-out.log',
      log_file: '/home/darc0/.pm2/logs/limen-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'limen',
      script: './target/release/agent',
      cwd: '/home/darc0/LIMEN/backend/agent',
      instances: 1,
      exec_mode: 'fork',
      error_file: '/tmp/limen-agent-error.log',
      out_file: '/tmp/limen-agent.log',
      log_file: '/home/darc0/.pm2/logs/limen-agent-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};

