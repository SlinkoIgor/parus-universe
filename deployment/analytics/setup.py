#!/usr/bin/env python3
"""Start the optional local Umami service and register the game's public ID.

Run on the VPS when publishing analytics. Does not publish the game or edit nginx.
The dashboard stays on loopback; access it through an SSH tunnel.
"""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

WEBSITE_ID = "638df471-e15b-4dfb-914b-447083317254"
DOMAIN = "starsail.fly"
API = "http://127.0.0.1:3100"
IMAGE = "ghcr.io/umami-software/umami:3.5.0"
ENV_KEYS = ("POSTGRES_PASSWORD", "APP_SECRET", "TWO_FACTOR_ENCRYPTION_KEY", "UMAMI_ADMIN_PASSWORD")


def prepare(directory):
    path = directory / ".env"
    if not path.exists():
        values = {key: secrets.token_hex(32) for key in ENV_KEYS}
        # Exclusive creation and private permissions, including before writing.
        with os.fdopen(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "w") as stream:
            stream.write("".join(f"{key}={value}\n" for key, value in values.items()))
    values = dict(line.split("=", 1) for line in path.read_text().splitlines() if line and not line.startswith("#"))
    if any(not re.fullmatch(r"[a-f0-9]{64}", values.get(key, "")) for key in ENV_KEYS):
        raise ValueError(".env must contain generated 64-character hex values; do not use .env.example placeholders")
    path.chmod(0o600)
    return values


def request(path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(API + path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
    with urlopen(req, timeout=30) as response:
        return json.load(response)


def initialize(password):
    # Reruns preserve the database, website, existing admin password and all stats.
    try:
        auth = request("/api/auth/login", {"username": "admin", "password": password})
    except HTTPError as error:
        if error.code != 401:
            raise
        auth = request("/api/auth/login", {"username": "admin", "password": "umami"})
        changed = request("/api/me/password", {"currentPassword": "umami", "newPassword": password}, auth["token"])
        auth = {"token": changed["token"]}
    if "token" not in auth:
        raise ValueError("Admin requires two-factor login; register the website in the existing dashboard")
    token = auth["token"]
    try:
        website = request(f"/api/websites/{WEBSITE_ID}", token=token)
    except HTTPError as error:
        if error.code != 404:
            raise
        website = None
    # Umami may return JSON null (200), rather than 404, for an unknown ID.
    if website is None:
        website = request("/api/websites", {"id": WEBSITE_ID, "name": "ПАРУС", "domain": DOMAIN}, token)
    if website["id"] != WEBSITE_ID or website["domain"] != DOMAIN:
        raise ValueError("Existing Umami website does not match analytics-config.js")


def provision_host_database(values):
    # Dedicated owner/database in the existing cluster; no other roles or DBs
    # are altered. Values are generated hex strings, never command arguments.
    password = values["POSTGRES_PASSWORD"]
    sql = fr"""
SELECT 'CREATE ROLE parus_umami LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 12'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'parus_umami')\gexec
ALTER ROLE parus_umami PASSWORD '{password}';
SELECT 'CREATE DATABASE parus_umami OWNER parus_umami'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'parus_umami')\gexec
"""
    subprocess.run(["runuser", "-u", "postgres", "--", "psql", "-X", "-v", "ON_ERROR_STOP=1"],
                   input=sql, text=True, cwd="/tmp", check=True, stdout=subprocess.DEVNULL)


def start_podman(directory, values):
    if directory != Path("/srv/parus/analytics") or os.geteuid() != 0:
        raise ValueError("Podman installation requires root in /srv/parus/analytics")
    provision_host_database(values)
    runtime = {
        "DATABASE_URL": f"postgresql://parus_umami:{values['POSTGRES_PASSWORD']}@127.0.0.1:5432/parus_umami",
        "APP_SECRET": values["APP_SECRET"], "TWO_FACTOR_ENCRYPTION_KEY": values["TWO_FACTOR_ENCRYPTION_KEY"],
        "DISABLE_TELEMETRY": "1", "NEXT_TELEMETRY_DISABLED": "1", "NODE_ENV": "production",
        "HOSTNAME": "127.0.0.1", "PORT": "3100", "NODE_OPTIONS": "--max-old-space-size=192",
    }
    path = directory / ".env.runtime"
    with os.fdopen(os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600), "w") as stream:
        stream.write("".join(f"{key}={value}\n" for key, value in runtime.items()))
    path.chmod(0o600)
    subprocess.run(["podman", "pull", IMAGE], check=True)
    shutil.copyfile(directory / "parus-analytics.service", "/etc/systemd/system/parus-analytics.service")
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "enable", "--now", "parus-analytics.service"], check=True)
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        try:
            with urlopen(API + "/api/heartbeat", timeout=10) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(2)
    raise ValueError("Umami did not become healthy; inspect the parus-analytics service")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-only", action="store_true", help="Generate private configuration without starting services")
    parser.add_argument("--runtime", choices=("compose", "podman"), default="compose",
                        help="Podman reuses host PostgreSQL and caps memory on the 1 GB VPS")
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    values = prepare(directory)
    if args.prepare_only:
        print("Private .env prepared. No services started.")
        return
    if args.runtime == "podman":
        start_podman(directory, values)
    else:
        subprocess.run(["docker", "compose", "up", "-d", "--wait", "--wait-timeout", "240"], cwd=directory, check=True)
    initialize(values["UMAMI_ADMIN_PASSWORD"])
    print("Umami ready at http://127.0.0.1:3100 (SSH tunnel). Login: admin.")
    print("Password: UMAMI_ADMIN_PASSWORD in the private .env file. No credentials printed.")
    print("Next: enable the nginx collector location and publish the checked game release; see docs/analytics.md.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        # Never print response bodies, tokens, generated passwords or DATABASE_URL.
        print(f"Umami setup failed ({type(error).__name__}). Check Docker, .env and the admin account.", file=sys.stderr)
        sys.exit(1)
