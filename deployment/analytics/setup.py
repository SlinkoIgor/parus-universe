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
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

WEBSITE_ID = "638df471-e15b-4dfb-914b-447083317254"
DOMAIN = "parus.165.232.99.124.sslip.io"
API = "http://127.0.0.1:3100"
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
        website = request("/api/websites", {"id": WEBSITE_ID, "name": "ПАРУС", "domain": DOMAIN}, token)
    if website["id"] != WEBSITE_ID or website["domain"] != DOMAIN:
        raise ValueError("Existing Umami website does not match analytics-config.js")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-only", action="store_true", help="Generate private configuration without starting services")
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    values = prepare(directory)
    if args.prepare_only:
        print("Private .env prepared. No services started.")
        return
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
