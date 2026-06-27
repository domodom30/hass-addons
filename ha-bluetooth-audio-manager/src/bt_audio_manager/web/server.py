"""aiohttp web server for the app's ingress UI and REST API.

The UI is a Vue 3 single-page app built by Vite (see ../../../../frontend).
The build output is copied into ``static/`` at image build time and looks like:

    static/index.html
    static/res/<content-hashed assets>.{js,css,woff2,...}

Assets are served from /res/ (not /static/) to avoid HA's frontend service
worker, which applies a CacheFirst strategy with ignoreSearch:true to any URL
containing "/static/". Vite content-hashes filenames, so the assets are
immutable and need no ?v= cache-busting; index.html itself is served no-cache
so new deployments are picked up immediately. Vite's relative base ("./res/...")
keeps every URL relative to the dynamic HA ingress prefix.
"""

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from aiohttp import web

from .api import create_api_routes
from .log_handler import WebSocketLogHandler

if TYPE_CHECKING:
    from ..manager import BluetoothAudioManager

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"
RES_DIR = STATIC_DIR / "res"
PORT = 8099


@web.middleware
async def _cache_headers(request: web.Request, handler):
    """Cache hashed assets aggressively; never cache index.html."""
    response = await handler(request)
    if request.path.startswith("/res/"):
        # Content-hashed filenames — safe to cache forever.
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


class WebServer:
    """Ingress web server providing the device management UI and REST API."""

    def __init__(
        self,
        manager: "BluetoothAudioManager",
        log_handler: WebSocketLogHandler | None = None,
    ):
        self._manager = manager
        self._app = web.Application(middlewares=[_cache_headers])
        self._runner: web.AppRunner | None = None
        self._index_html: str | None = None

        # API routes
        api_routes = create_api_routes(manager, log_handler=log_handler)
        self._app.router.add_routes(api_routes)

        # Built assets — served from /res/ to bypass HA's service worker.
        self._app.router.add_static("/res", RES_DIR)

        # Root serves the SPA shell.
        self._app.router.add_get("/", self._serve_index)

    def _get_index_html(self) -> str:
        """Read and cache the built index.html (Vite handles asset URLs)."""
        if self._index_html is None:
            self._index_html = (STATIC_DIR / "index.html").read_text()
        return self._index_html

    async def _serve_index(self, request: web.Request) -> web.Response:
        """Serve the SPA shell with no-cache headers."""
        return web.Response(
            text=self._get_index_html(),
            content_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    async def start(self) -> None:
        """Start the web server."""
        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, "0.0.0.0", PORT)
        await site.start()
        logger.info("Web server listening on port %d", PORT)

    async def stop(self) -> None:
        """Stop the web server."""
        if self._runner:
            await self._runner.cleanup()
        logger.info("Web server stopped")
