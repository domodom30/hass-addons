"""Auto-reconnection service with exponential backoff.

Monitors D-Bus PropertiesChanged signals for Connected=false events
and attempts to reconnect paired devices automatically.
"""

import asyncio
import logging
import random
from typing import TYPE_CHECKING

from dbus_next.errors import DBusError

if TYPE_CHECKING:
    from .manager import BluetoothAudioManager

logger = logging.getLogger(__name__)


class ReconnectService:
    """Manages automatic reconnection of disconnected Bluetooth audio devices."""

    QUICK_RETRY_DELAY = 10  # seconds — fast first attempt for transient glitches

    # BlueZ Connect() errors caused by stale connection state on our side
    # (e.g. avdtp_connect_cb() "Operation already in progress" / EALREADY,
    # which BlueZ reports as br-connection-unknown) rather than an absent
    # speaker.  They fail in milliseconds and never clear on their own.
    STALE_CONN_ERRORS = (
        "br-connection-unknown",
        "br-connection-busy",
        "br-connection-already-connected",
        "br-connection-canceled",
    )
    STALE_CLEAR_THRESHOLD = 2  # consecutive stale failures before clearing
    STALE_CLEAR_EVERY = 3  # then clear again every N stale failures

    def __init__(self, manager: "BluetoothAudioManager"):
        self._manager = manager
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False

    async def start(self) -> None:
        """Start monitoring for disconnections."""
        self._running = True
        logger.info("Reconnect service started")

    async def stop(self) -> None:
        """Stop all reconnection attempts."""
        self._running = False
        for address, task in self._tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self._tasks.clear()
        logger.info("Reconnect service stopped")

    def handle_disconnect(self, address: str) -> None:
        """Called when a device disconnects. Schedules reconnection."""
        if not self._running:
            return
        if not self._manager.config.auto_reconnect:
            return

        # Check if device is in our persistent store with auto_connect
        device_info = self._manager.store.get_device(address)
        if not device_info or not device_info.get("auto_connect", True):
            logger.debug("Skipping reconnect for %s (not auto-connect)", address)
            return

        if address in self._tasks and not self._tasks[address].done():
            logger.debug("Already reconnecting to %s", address)
            return

        self._tasks[address] = asyncio.create_task(self._reconnect_loop(address))

    def cancel_reconnect(self, address: str) -> None:
        """Cancel any pending reconnection for a device."""
        task = self._tasks.pop(address, None)
        if task and not task.done():
            task.cancel()

    async def reconnect_all(self) -> None:
        """Attempt to reconnect all auto-connect devices (called on startup)."""
        devices = self._manager.store.auto_connect_devices
        if not devices:
            return

        logger.info("Attempting to reconnect %d stored device(s)...", len(devices))
        for device_info in devices:
            address = device_info["address"]
            self._tasks[address] = asyncio.create_task(
                self._reconnect_loop(address)
            )

    async def _reconnect_loop(self, address: str) -> None:
        """Attempt reconnection with exponential backoff and jitter."""
        # Check if already connected (e.g. device persisted across app restart)
        device = self._manager.managed_devices.get(address)
        if device:
            try:
                if await device.is_connected():
                    logger.info("Device %s already connected, skipping reconnect", address)
                    self._tasks.pop(address, None)
                    return
            except Exception as e:
                logger.debug("is_connected check failed for %s: %s", address, e)

        # Quick first attempt — handles transient glitches (e.g. AVRCP bugs)
        logger.info(
            "Quick reconnect to %s in %ds...", address, self.QUICK_RETRY_DELAY
        )
        self._manager._broadcast_status(
            f"Quick reconnect to {address} in {self.QUICK_RETRY_DELAY}s..."
        )
        await asyncio.sleep(self.QUICK_RETRY_DELAY)

        if not self._running:
            return

        stale_failures = 0
        try:
            success = await self._manager.connect_device(
                address, _from_reconnect=True
            )
            if success:
                logger.info("Quick reconnect to %s succeeded", address)
                self._manager._broadcast_status(f"Reconnected to {address}")
                self._tasks.pop(address, None)
                return
            logger.info(
                "Quick reconnect to %s failed (no sink) — falling back to backoff",
                address,
            )
        except (DBusError, asyncio.TimeoutError, OSError) as e:
            logger.info(
                "Quick reconnect to %s failed: %s — falling back to backoff",
                address, e,
            )
            stale_failures = await self._handle_failure(address, e, stale_failures)

        interval = self._manager.config.reconnect_interval_seconds
        max_backoff = self._manager.config.reconnect_max_backoff_seconds
        attempt = 0

        while self._running:
            wait = min(interval * (2 ** attempt), max_backoff)
            jitter = random.uniform(0, wait * 0.1)
            total_wait = wait + jitter

            logger.info(
                "Reconnect to %s: attempt %d in %.0fs",
                address, attempt + 1, total_wait,
            )
            self._manager._broadcast_status(
                f"Reconnecting to {address} in {int(total_wait)}s "
                f"(attempt {attempt + 1})..."
            )
            await asyncio.sleep(total_wait)

            if not self._running:
                return

            try:
                success = await self._manager.connect_device(
                    address, _from_reconnect=True
                )
                if success:
                    logger.info(
                        "Reconnected to %s after %d attempt(s)", address, attempt + 1
                    )
                    self._manager._broadcast_status(
                        f"Reconnected to {address}"
                    )
                    self._tasks.pop(address, None)
                    return
                stale_failures = 0
            except (DBusError, asyncio.TimeoutError, OSError) as e:
                logger.warning(
                    "Reconnect attempt %d for %s failed: %s",
                    attempt + 1, address, e,
                )
                self._manager._broadcast_status(
                    f"Reconnect attempt {attempt + 1} for {address} failed"
                )
                stale_failures = await self._handle_failure(
                    address, e, stale_failures
                )

            attempt += 1

    @classmethod
    def _is_stale_conn_error(cls, error: Exception) -> bool:
        if not isinstance(error, DBusError):
            return False
        text = getattr(error, "text", None) or str(error)
        return any(code in text for code in cls.STALE_CONN_ERRORS)

    async def _handle_failure(
        self, address: str, error: Exception, stale_failures: int
    ) -> int:
        """Track consecutive stale-state failures; clear them periodically.

        Returns the updated consecutive stale failure count.
        """
        if not self._is_stale_conn_error(error):
            return 0
        stale_failures += 1
        since_threshold = stale_failures - self.STALE_CLEAR_THRESHOLD
        if since_threshold >= 0 and since_threshold % self.STALE_CLEAR_EVERY == 0:
            await self._clear_stale_connection(address, error)
        return stale_failures

    async def _clear_stale_connection(self, address: str, error: Exception) -> None:
        """Abort a stuck pending connection in BlueZ/kernel.

        Device1.Disconnect() cancels a pending ACL/L2CAP connect even when
        the device is not connected.  Calls the device wrapper directly —
        manager.disconnect_device() would suppress auto-reconnect and cancel
        this loop.  The adapter is never power-cycled: it is shared with the
        HA Bluetooth integration and its power state is managed by HAOS.
        """
        logger.warning(
            "Clearing stale BlueZ connection state for %s (%s)", address, error
        )
        self._manager._broadcast_status(
            f"Clearing stale connection state for {address}..."
        )
        try:
            device = self._manager.managed_devices.get(address)
            if not device:
                device = await self._manager._get_or_create_device(address)
            await device.disconnect()
        except Exception as e:
            logger.debug("Stale connection clear failed for %s: %s", address, e)
            return
        await asyncio.sleep(3)
