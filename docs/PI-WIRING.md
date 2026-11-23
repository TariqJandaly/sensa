# Wiring the Pi prototype to the server

This is for whoever writes the watch code. It starts from the prototype
that already exists (the `sensa.py` main loop, the `Reading` dataclass, the
`append_jsonl` log, `DEMO_MODE`), and adds one new job: publishing to the
server. Nothing that already works gets thrown away.

If you have not linked the device in the web app yet, do that first:
[DEVICE-GUIDE.md](DEVICE-GUIDE.md). You need the device id and the device
token from the setup page before any of the code below runs.

## The idea in one paragraph

The watch keeps doing what it does today: read the sensors, assess the
reading, log one JSON line locally, show it on the OLED, vibrate on alert.
The only change is that each reading also goes into a small queue, and a
background thread ships those readings to the MQTT broker in batches. The
broker, the bridge and the server take it from there. When wifi drops, the
queue waits. Nothing is lost, because every reading carries the time it was
actually measured.

## What to install

On the Pi (Raspberry Pi OS, Python 3):

```bash
sudo apt install mosquitto-clients   # handy for debugging, not required
pip install "paho-mqtt<2"            # v2 works too but prints a version
                                     # warning unless the constructor call
                                     # is updated
```

If you later add the NEO-6 GPS for the SOS button: `pip install pyserial`.

## New settings in sensa_config.py

Add these next to the existing ones and keep them out of any git repo:

```python
# --- server link ---
MQTT_HOST = "192.168.68.105"   # the machine running the broker
MQTT_PORT = 1883
DEVICE_ID = "paste-the-device-id-from-the-setup-page"
DEVICE_TOKEN = "paste-the-device-token-from-the-setup-page"
BATTERY_PCT = None             # set a number if you add a fuel gauge
```

The lab broker currently accepts anonymous connections, so the token is not
needed to connect to the broker itself. The token is what the bridge uses
to talk to the web API on the device's behalf. When the broker gets real
credentials later, you will add a username and password to the connect call
below and nothing else changes.

## New file: sensa_publisher.py

```python
"""Sensa publisher: batches readings and ships them to the server.

The reading keeps flowing to the local JSONL log exactly as before.
This module only adds the network leg.
"""
import json
import threading
from collections import deque
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from sensa_config import (
    MQTT_HOST,
    MQTT_PORT,
    DEVICE_ID,
    DEVICE_TOKEN,
    BATTERY_PCT,
)

QUEUE_LIMIT = 5000        # about 17 hours of readings at one every 12s
BATCH_SIZE = 6
FLUSH_SECONDS = 30


def iso_now():
    return datetime.now(timezone.utc).isoformat()


def to_wire(reading, captured_at):
    """Map the local Reading dataclass onto the server contract.

    Adjust the attribute names on the left to match your dataclass if
    they differ. The right-hand names are fixed: the server validates
    them and rejects anything else.
    """
    return {
        "capturedAt": captured_at,
        "hrBpm": getattr(reading, "heart_rate_bpm", None),
        "spo2Pct": getattr(reading, "spo2_percent", None),
        "tempC": getattr(reading, "temperature_c", None),
        "gsrOhm": getattr(reading, "gsr_ohm", None),
        "accelX": getattr(reading, "accel_x", None),
        "accelY": getattr(reading, "accel_y", None),
        "accelZ": getattr(reading, "accel_z", None),
        "status": getattr(reading, "status", "SAFE"),
        "flags": list(getattr(reading, "notes", []) or []),
    }


class SensaPublisher:
    def __init__(self):
        self.topic = f"sensa/{DEVICE_ID}"
        self.queue = deque(maxlen=QUEUE_LIMIT)
        self.lock = threading.Lock()
        self.stop = threading.Event()

        self.client = mqtt.Client(client_id=f"sensa-{DEVICE_ID}")
        # Reconnect forever, with a polite backoff.
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=30)
        self.client.loop_start()

        threading.Thread(target=self._flush_loop, daemon=True).start()
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()

    # ---- called from the main sensor loop ----

    def add_reading(self, reading):
        """Call right where append_jsonl() is called today."""
        captured_at = iso_now()
        with self.lock:
            self.queue.append(to_wire(reading, captured_at))
            full = len(self.queue) >= BATCH_SIZE
        if full:
            self.flush()

    def sos(self, lat, lng):
        """The emergency button. No batching, no waiting."""
        message = json.dumps({"capturedAt": iso_now(), "lat": lat, "lng": lng})
        self.client.publish(f"{self.topic}/sos", message, qos=1)

    # ---- background work ----

    def flush(self):
        with self.lock:
            batch = list(self.queue)
            self.queue.clear()
        if not batch:
            return
        message = json.dumps({"deviceId": DEVICE_ID, "readings": batch})
        info = self.client.publish(f"{self.topic}/readings", message, qos=1)
        if info.rc != mqtt.MQTT_ERR_SUCCESS:
            # Not connected (yet). Put the batch back and try next cycle.
            with self.lock:
                self.queue.extendleft(reversed(batch))

    def _flush_loop(self):
        while not self.stop.wait(FLUSH_SECONDS):
            self.flush()

    def _heartbeat_loop(self):
        while not self.stop.wait(30):
            body = {"ts": iso_now()}
            if BATTERY_PCT is not None:
                body["batteryPct"] = int(BATTERY_PCT)
            self.client.publish(f"{self.topic}/heartbeat", json.dumps(body), qos=1)

    def close(self):
        """Call from handle_exit so nothing is lost on shutdown."""
        self.stop.set()
        self.flush()
        self.client.disconnect()
        self.client.loop_stop()
```

Two details worth understanding:

- `captured_at` is stamped in `add_reading`, at the moment the sensors were
  read, not when the batch leaves. This is what makes the server's history
  truthful when wifi was down for an hour.
- A failed publish puts the batch back at the front of the queue. The queue
  holds the newest 5000 readings, so a long outage drops the oldest first,
  which is the right trade for a health monitor.

## The three places to touch in sensa.py

**1. Start the publisher after the hardware comes up** (near where the
vibration pin and OLED are initialized):

```python
from sensa_publisher import SensaPublisher

publisher = SensaPublisher()
```

**2. In the main loop, right next to the existing log write:**

```python
# keep this exactly as it is
append_jsonl(reading)

# and add one line next to it
publisher.add_reading(reading)
```

**3. In handle_exit, before the program ends:**

```python
def handle_exit(signum, frame):
    global running
    running = False
    ...
    publisher.close()      # flushes whatever is still queued
```

## The SOS button and the GPS

The emergency button already exists in the wiring (push button on a GPIO
line). Give it the same treatment the vibration pin got with gpiozero:

```python
from gpiozero import Button

def on_emergency():
    lat, lng = read_gps()          # may be None if no fix yet
    if lat is None:
        # No fix: still send. The event matters more than the map pin.
        publisher.sos(0.0, 0.0)
        return
    publisher.sos(lat, lng)

button = Button(18)                # your BCM pin number
button.when_pressed = on_emergency
```

For the NEO-6 on the Pi's serial port, a minimal NMEA reader that pulls
latitude and longitude from a GGA sentence:

```python
import serial

def read_gps(timeout=3.0):
    """Returns (lat, lng) or (None, None). Adjust the port if needed."""
    try:
        with serial.Serial("/dev/serial0", 9600, timeout=1) as gps:
            gps.reset_input_buffer()
            deadline = time.time() + timeout
            while time.time() < deadline:
                line = gps.readline().decode("ascii", errors="ignore").strip()
                if not line.startswith("$GPGGA"):
                    continue
                parts = line.split(",")
                if len(parts) < 6 or parts[6] == "0":
                    continue        # no fix yet
                lat = _nmea_to_degrees(parts[2], parts[3])
                lng = _nmea_to_degrees(parts[4], parts[5])
                return lat, lng
    except Exception:
        pass
    return None, None

def _nmea_to_degrees(value, hemisphere):
    if not value:
        return None
    degrees = float(value[:2]) if hemisphere in ("N", "S") else float(value[:3])
    minutes = float(value[-7:])
    result = degrees + minutes / 60.0
    return -result if hemisphere in ("S", "W") else result
```

Import `time` and `serial` at the top. If the emergency button fires while
the GPS has no fix, send zeros anyway: the SOS event reaching the family
matters more than the map pin.

## Battery percentage

The heartbeat field is optional. The prototype has a TP4056 charger but no
fuel gauge, so it is fine to leave `batteryPct` out for now (the dashboard
hides the battery line) or to send a rough number from an INA219 if one is
added later. What must not be skipped is the heartbeat itself, because the
ONLINE/OFFLINE state and the "feed went quiet" event both come from it.

## Testing it without sensors

`DEMO_MODE` already makes the prototype run with simulated readings, which
is exactly what you want here:

1. Provision a device in the web app and paste the id and token into
   `sensa_config.py`.
2. Start the bridge on the server machine (see DEVICE-GUIDE.md).
3. Run `sensa.py` on the Pi (or anywhere with Python) with `DEMO_MODE=True`.
4. Open the dashboard. Inside a minute you should see the first readings,
   the device going ONLINE, and the chart filling.
5. Tap the emergency button (or call `publisher.sos(21.5433, 39.1728)` from
   a Python shell) and watch the alerts page get a new row with a map link,
   plus a push notification on a phone that subscribed.

## Checklist before a live demo

- [ ] `capturedAt` sends UTC with a timezone suffix (`...Z` or `+03:00`)
- [ ] field names match the table in DEVICE-GUIDE.md (the bridge log names
      the first field that fails)
- [ ] heartbeat every 30 seconds, visible in the bridge terminal
- [ ] SOS produces one event on the alerts page, with coordinates
- [ ] `publisher.close()` runs on shutdown, so the last batch is not lost
- [ ] the local JSONL log still works, it is your black box when wifi fails
