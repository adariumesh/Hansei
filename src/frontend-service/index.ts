import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen.js';

/**
 * Frontend Service
 * 
 * Serves static frontend HTML inline for development
 * For production, consider using SmartBucket or nginx
 * 
 * Routes:
 * - GET / - Redirect to webhansei.us (main interface)
 * - GET /3d - Serve 3D memory graph inline
 * - GET /spatial - Redirect to webhansei.us/spatial
 * - GET /health - Health check
 */

const app = new Hono<{ Bindings: Env }>();

// Redirect to main frontend (served by nginx on webhansei.us)
app.get('/', (c) => {
  return c.redirect('https://webhansei.us/', 302);
});

// Provide deployment instructions for /3d route
app.get('/3d', (c) => {
  const instructions = `
<!DOCTYPE html>
<html>
<head>
    <title>HANSEI - Deployment Required</title>
    <style>
        body {
            font-family: system-ui;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255,255,255,0.1);
            padding: 2rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
        }
        code {
            background: rgba(0,0,0,0.3);
            padding: 0.2rem 0.5rem;
            border-radius: 0.25rem;
            font-family: monospace;
        }
        pre {
            background: rgba(0,0,0,0.5);
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
        }
        a {
            color: #00ffff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 HANSEI Frontend Deployment Required</h1>
        
        <p>The <code>/3d</code> interface requires deploying the updated <code>index-3d.html</code> to your web server.</p>
        
        <h2>New Features Available:</h2>
        <ul>
            <li>✨ <strong>AI Analysis Tooltips</strong> - Hover over nodes to see entities, themes, and sentiment</li>
            <li>📌 <strong>Right-click Context Menu</strong> - Pin, mark sensitive, or delete memories</li>
            <li>🎯 <strong>Demo Mode Indicator</strong> - Visual badge for demo data</li>
            <li>🔒 <strong>Privacy Badges</strong> - See which memories are pinned or sensitive</li>
        </ul>
        
        <h2>Option 1: Use API Gateway Direct Access</h2>
        <p>For immediate testing, access the API directly (no HTML UI):</p>
        <pre>curl https://svc-01kabqaz48d5vvdjmxc6pxcr7e.01ka41m1warcc7s5zveqw1tt3z.lmapp.run/api/graph?user_id=demo_anne_frank_v2</pre>
        
        <h2>Option 2: Deploy to webhansei.us</h2>
        <p>Upload the updated HTML file to your nginx server:</p>
        <pre>scp hansei/frontend/index-3d.html your-server:/var/www/webhansei.us/3d.html
# Or update nginx to serve from:
# /var/www/webhansei.us/index-3d.html</pre>
        
        <p>Then reload nginx configuration.</p>
        
        <h2>Current Status:</h2>
        <ul>
            <li>✅ Backend APIs fully deployed (30 modules running)</li>
            <li>✅ AI analysis working (llama-3.3-70b)</li>
            <li>✅ Delete/Pin/Sensitive endpoints ready</li>
            <li>⏳ Frontend HTML needs nginx deployment</li>
        </ul>
        
        <p><a href="https://webhansei.us/3d">→ Go to webhansei.us/3d (may show cached version)</a></p>
    </div>
</body>
</html>
  `;
  
  return c.html(instructions);
});

// Redirect to spatial UI
app.get('/spatial', (c) => {
  return c.redirect('https://webhansei.us/spatial', 302);
});

// Serve favicon
app.get('/favicon.ico', (c) => {
  return new Response(null, { status: 204 });
});

// Health check
app.get('/health', (c) => {
  return c.json({ 
    service: 'frontend-service',
    status: 'ok',
    frontend_url: 'https://webhansei.us',
    timestamp: new Date().toISOString() 
  });
});

export default class FrontendService extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
