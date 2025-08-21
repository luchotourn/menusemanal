import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Validate critical environment variables in production
function validateEnvironment() {
  console.log('🔧 Validating environment variables...');
  const requiredEnvVars = ['DATABASE_URL'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these environment variables and restart the application.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are present');
}

// Add startup logging
console.log('🚀 Starting Menu Familiar application...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📊 Node version:', process.version);
console.log('💾 Memory usage:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');

// Validate environment in production
if (process.env.NODE_ENV === 'production') {
  validateEnvironment();
} else {
  console.log('⚠️  Running in development mode, skipping environment validation');
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Add process-level error handlers for production stability
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') {
    console.error('Server will continue running...');
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'production') {
    console.error('Server will continue running...');
  } else {
    process.exit(1);
  }
});

(async () => {
  try {
    console.log('🔗 Setting up routes and database connections...');
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error details for debugging
      console.error('Server error:', {
        status,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: _req.url,
        method: _req.method
      });

      // Send error response
      if (!res.headersSent) {
        res.status(status).json({ message });
      }

      // Don't throw in production to prevent server crashes
      if (process.env.NODE_ENV === 'production') {
        return;
      }
      
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log('🔧 Setting up Vite development server...');
      await setupVite(app, server);
    } else {
      console.log('📦 Setting up static file serving for production...');
      serveStatic(app);
    }

    // Use PORT from environment or default to 5000
    // this serves both the API and the client.
    const port = parseInt(process.env.PORT || '5000');
    const host = "0.0.0.0"; // Allow access from network devices
    server.listen(port, host, () => {
      console.log('🎉 Server successfully started!');
      log(`serving on port ${port}`);
      console.log('🌐 Health check endpoints:');
      console.log(`   • Smart Root: http://${host}:${port}/ (health check for deployment, React app for browsers)`);
      console.log(`   • API Health: http://${host}:${port}/api/health-check`); 
      console.log(`   • Health: http://${host}:${port}/health`);
      if (process.env.NODE_ENV === 'production') {
        console.log('✅ Production deployment ready for health checks');
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('Server startup failed. Check environment variables and database connection.');
    }
    process.exit(1);
  }
})();
