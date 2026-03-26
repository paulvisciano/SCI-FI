#!/usr/bin/env node
// NeuroGraph Server (dual-view visualization)
// HTTPS server for secure access

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// === Configuration ===
const PORT_HTTPS = 18788;
const PORT_HTTP = 18789;

// === HTTPS Configuration (self-signed certs) ===
const HTTPS_ENABLED = process.env.NEUROGRAPH_HTTPS_ENABLED !== 'false';
const HTTPS_OPTIONS = {
    key: fs.readFileSync(path.join(__dirname, 'assets', 'https-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'assets', 'https-cert.pem'))
};

// === Serve Static Files ===
function serveStatic(req, res) {
    let urlPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, urlPath);
    
    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        
        res.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'text/plain',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(content);
    });
}

// === Create Servers ===
const appDir = __dirname;

if (HTTPS_ENABLED) {
    // HTTPS server (primary)
    const httpsServer = https.createServer(HTTPS_OPTIONS, serveStatic);
    httpsServer.listen(PORT_HTTPS, () => {
        console.log(`NeuroGraph HTTPS server running on https://localhost:${PORT_HTTPS}`);
        console.log(`Open: https://localhost:${PORT_HTTPS}/dual-index.html`);
    });
}

// HTTP redirector (fallback)
const httpServer = http.createServer((req, res) => {
    if (HTTPS_ENABLED) {
        // Redirect to HTTPS
        res.writeHead(301, { 'Location': `https://localhost:${PORT_HTTPS}${req.url}` });
        res.end();
    } else {
        serveStatic(req, res);
    }
});

httpServer.listen(PORT_HTTP, () => {
    if (!HTTPS_ENABLED) {
        console.log(`NeuroGraph HTTP server running on http://localhost:${PORT_HTTP}`);
        console.log(`Open: http://localhost:${PORT_HTTP}/dual-index.html`);
    }
});

// === Auto-open in browser ===
setTimeout(() => {
    try {
        const url = HTTPS_ENABLED 
            ? `https://localhost:${PORT_HTTPS}/dual-index.html`
            : `http://localhost:${PORT_HTTP}/dual-index.html`;
        console.log(`\nOpen in browser: ${url}\n`);
    } catch (e) {
        // Ignore
    }
}, 500);
