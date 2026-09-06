#!/usr/bin/env python3
"""Test-Harness fuer den Deep Link (Kontrakt K7).

Serviert das Repo-Verzeichnis, schreibt beim Ausliefern nur im Speicher um und
legt niemals eine Datei an. Kein Produktivcode, keine Dependency, stdlib pur.

  python3 tests/dev-server.py [port]     # Standard 8080

Umgeschrieben wird beim Ausliefern:
  index.html      gtag-Stub und der Script-Tag fuer js/deeplink.js vor booking.js
  js/booking.js   API-Host auf leer, damit alles an die gleiche Origin geht

Beantwortet wird zusaetzlich: GET /health, GET /api/offers (aus der Fixture,
mit ?fixture=empty leer) und POST /api/bookings (synthetischer Erfolg, der
Body geht auf stdout). Durch den Harness laufen ausschliesslich Testdaten.
"""
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "offers-hcsi.json"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
LIVE_API = "'https://amanthos-website-api.onrender.com'"
BOOKING_TAG = '<script src="./js/booking.js" defer></script>'
INJECT = (
    "<script>window.dataLayer=window.dataLayer||[];window.__gtagCalls=[];"
    "window.gtag=function(){window.__gtagCalls.push("
    "Array.prototype.slice.call(arguments));};</script>\n"
    '  <script src="./js/deeplink.js" defer></script>\n  '
)


class Harness(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def _send(self, body, ctype, status=200):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parts = urlsplit(self.path)
        path = parts.path
        if path == "/health":
            return self._send('{"status":"ok"}', "application/json")
        if path == "/api/offers":
            # fixture=empty gilt am Endpunkt selbst und an der aufrufenden
            # Seite, damit sich der leere Fall auch im Browser aufrufen laesst.
            referer = self.headers.get("Referer") or ""
            if "empty" in parse_qs(parts.query).get("fixture", []) or "fixture=empty" in referer:
                return self._send('{"offers": []}', "application/json")
            return self._send(FIXTURE.read_text(encoding="utf-8"), "application/json")
        if path in ("/", "/index.html"):
            html = (ROOT / "index.html").read_text(encoding="utf-8")
            if BOOKING_TAG not in html:
                raise RuntimeError("Script-Tag fuer booking.js nicht gefunden")
            html = html.replace(BOOKING_TAG, INJECT + BOOKING_TAG, 1)
            return self._send(html, "text/html; charset=utf-8")
        if path == "/js/booking.js":
            js = (ROOT / "js" / "booking.js").read_text(encoding="utf-8")
            return self._send(js.replace(LIVE_API, "''", 1),
                              "application/javascript; charset=utf-8")
        return super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/bookings":
            return self._send('{"error": "not found"}', "application/json", 404)
        size = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(size).decode("utf-8", "replace")
        print("BOOKING-BODY " + raw, flush=True)
        return self._send(json.dumps({
            "success": True,
            "confirmationId": "TEST-0001",
            "reservationId": "TEST-RES-0001",
            "paymentRequired": False,
        }), "application/json")


if __name__ == "__main__":
    print("Harness auf http://localhost:%d aus %s" % (PORT, ROOT), flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Harness).serve_forever()
