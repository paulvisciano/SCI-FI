#!/bin/bash
# J.A.R.V.I.S Syntax Guard — Validate before commit
# Usage: ./validate.sh
# No npm/build tools needed — uses native node --check

set -e

echo "🛡️  J.A.R.V.I.S Syntax Guard"
echo "============================"

cd "$(dirname "$0")"

ERRORS=0

# Check JavaScript files
echo "Checking JavaScript..."
for f in *.js; do
    if [[ -f "$f" ]]; then
        if node --check "$f" 2>/dev/null; then
            echo "  ✅ $f"
        else
            echo "  ❌ $f — syntax error"
            node --check "$f" 2>&1 | sed 's/^/     /'
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# Check HTML (basic patterns)
echo "Checking HTML..."
if [[ -f "index.html" ]]; then
    # Check for unclosed tags (rough heuristic)
    if grep -qE "<(div|span|script|style)[^>]*$" index.html 2>/dev/null; then
        echo "  ⚠️  index.html — possible unclosed tag"
    else
        echo "  ✅ index.html"
    fi
    
    # Check for unclosed quotes
    if grep -qE "=\"[^\"]*$" index.html 2>/dev/null; then
        echo "  ⚠️  index.html — possible unclosed quote"
    fi
fi

# Summary
echo "============================"
if [[ $ERRORS -gt 0 ]]; then
    echo "❌ Failed: $ERRORS file(s) with syntax errors"
    exit 1
else
    echo "✅ All checks passed"
    exit 0
fi
