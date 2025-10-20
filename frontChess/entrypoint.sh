#!/bin/sh
set -e

# Create a small env script that sets window.__API_URL__ so runtime API base can be injected
cat > /app/dist/env.js <<'EOF'
(function(){
  try {
    var api = typeof process !== 'undefined' && process.env && process.env.VITE_API_URL ? process.env.VITE_API_URL : (window && window.__API_URL__ ? window.__API_URL__ : undefined);
    if (typeof api === 'undefined') {
      // attempt to read environment variable replaced by docker at runtime
      api = (function(){
        try { return '%VITE_API_URL%'; } catch(e){ return undefined; }
      })();
    }
    // replace placeholder if it wasn't replaced
    if (api && api.indexOf('%VITE_API_URL%') === -1) {
      window.__API_URL__ = api;
    }
  } catch (e) { /* ignore */ }
})();
EOF

# If a runtime env var API_URL is provided, write a small script that sets window.__API_URL__
if [ -n "$VITE_API_URL" ]; then
  cat > /app/dist/env.js <<EOF
(function(){ window.__API_URL__ = "${VITE_API_URL}"; })();
EOF
fi

exec "$@"
