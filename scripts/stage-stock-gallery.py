#!/usr/bin/env python3
"""Stage reviewed JPEGs in order for an exact Stock ID. Requires requests and an owner session.
Example: python3 scripts/stage-stock-gallery.py --origin http://127.0.0.1:7777 --account acc_teajia_bali --stock-id <uuid> wide.jpg detail.jpg
The origin must serve both Teajia and its API. The command prints the signed-in review URL.
"""
import argparse
import getpass
import hashlib
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', required=True)
    parser.add_argument('--account', required=True)
    parser.add_argument('--stock-id', required=True)
    parser.add_argument('photos', nargs='+', type=Path, help='Reviewed JPEGs, main photo first')
    args = parser.parse_args()
    origin = args.origin.rstrip('/')
    target = urlsplit(origin)
    if not ((target.scheme in ('http', 'https') and target.hostname in ('127.0.0.1', 'localhost', '::1'))
            or origin in ('https://www.teajia.com', 'https://teajia.com')) or target.username or target.password or target.path or target.query or target.fragment:
        parser.error('Choose the loopback preview or the Teajia shop origin.')
    try:
        UUID(args.stock_id)
    except ValueError:
        parser.error('Supply the exact Stock UUID.')
    if not 1 <= len(args.photos) <= 4:
        parser.error('Choose one to four ordered JPEG files.')
    files = []
    hashes = []
    for path in args.photos:
        if path.stat().st_size > 6 * 1024 * 1024:
            parser.error('Each photo must be at most 6 MiB.')
        data = path.read_bytes()
        if not data.startswith(b'\xff\xd8\xff') or not data.endswith(b'\xff\xd9'):
            parser.error('Choose JPEG files.')
        hashes.append(hashlib.sha256(data).hexdigest())
        files.append(('photo', (path.name, data, 'image/jpeg')))
    if len(set(hashes)) != len(hashes):
        parser.error('A photo appears twice.')
    token = os.environ.get('TEAJIA_OWNER_TOKEN') or getpass.getpass('Teajia owner session token: ')
    headers = {'Authorization': 'Bearer ' + token, 'X-Teajia-Account': args.account}
    response = requests.post(origin + '/api/admin/stock-gallery/' + args.stock_id, files=files,
                             headers=headers, allow_redirects=False, timeout=90)
    if response.status_code not in (200, 201):
        parser.exit(1, 'Could not stage the gallery (HTTP ' + str(response.status_code) + ').\n')
    result = response.json()
    if result['stockId'] != args.stock_id or [p['sha256'] for p in result['photos']] != hashes:
        parser.exit(1, 'Stock ID or ordered photo hashes differ from the submitted files.\n')
    print(('Staged' if response.status_code == 201 else 'Already staged') + ' · ' + origin + result['previewPath'])


if __name__ == '__main__':
    main()
