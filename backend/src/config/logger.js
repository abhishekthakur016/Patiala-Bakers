import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.logLevel,
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.passwordHash'],
  ...(env.isProd ? {} : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } } }),
});
