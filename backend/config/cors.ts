import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration for CORS (Cross-Origin Resource Sharing)
 * Allows the frontend to communicate with the backend
 */
export default defineConfig({
  /**
   * Enabled for all routes
   */
  enabled: true,

  /**
   * Allow requests from frontend origin
   */
  origin: [
    'http://localhost:3003',
    'http://localhost:3000',
    'http://localhost:3333',
  ],

  /**
   * Allow credentials (cookies, authorization headers)
   */
  credentials: true,

  /**
   * Allowed HTTP methods
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],

  /**
   * Allowed headers
   */
  headers: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],

  /**
   * Expose headers to the client
   */
  exposeHeaders: ['Content-Range', 'X-Content-Range'],

  /**
   * Max age for preflight requests (in seconds)
   */
  maxAge: 86400,
})
