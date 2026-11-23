#!/usr/bin/env python3
"""Prepare a private owner photo proposal from an effective board and intake manifest."""

import argparse
import hashlib
import json
import re
import tempfile
from pathlib import Path


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def jpeg(path):
    data = path.read_bytes()
    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError(f"Invalid JPEG: {path.name}")
    return data


def original_paths(source_file, intake_root):
    paths = {}
    preview_dir = (intake_root / "work/images").resolve()
    for source in json.loads(source_file.read_bytes()):
        path = (intake_root / source["preview"]).resolve()
        if path.parent != preview_dir or path.suffix.lower() != ".jpg":
            raise ValueError("An original preview path is outside the intake images")
        if source["uuid"] in paths:
            raise ValueError("Duplicate original source ID")
        paths[source["uuid"]] = path
    return paths


def read_pots(board_file):
    pots = {}
    for pot in json.loads(board_file.read_bytes())["pots"]:
        pot_id = pot["id"]
        if not re.fullmatch(r"pots-\d{2}", pot_id) or pot_id in pots:
            raise ValueError("Invalid or duplicate board pot ID")
        if not isinstance(pot["photos"], list):
            raise ValueError(f"Unexpected gallery length for {pot_id}")
        pots[pot_id] = pot["photos"]
    return pots


def validate_role(role):
    if not isinstance(role, str) or not role.strip() or len(role) > 72:
        raise ValueError("Invalid photo role")


def read_holds(path):
    review = json.loads(path.read_bytes())
    if review.get("version") != 1 or not isinstance(review.get("holds"), list):
        raise ValueError("Supply a version 1 review-holds file with a holds list")
    holds = set()
    for entry in review["holds"]:
        key = (entry["potId"], entry["sourceId"])
        if not all(isinstance(value, str) and value.strip() for value in key) or key in holds:
            raise ValueError("Invalid or duplicate review hold")
        holds.add(key)
    return holds


def build(board_file, manifest_file, source_file, intake_root, holds_file, output):
    board = read_pots(board_file)
    manifest = manifest_file.read_bytes()
    groups = {key: group for key, group in json.loads(manifest)["groups"].items()
              if group["kind"] == "pots"}
    if not board or groups.keys() != board.keys():
        raise ValueError("The reviewed intake and effective board have different pot IDs")
    originals = original_paths(source_file, intake_root)
    holds = read_holds(holds_file)
    matched_holds = set()
    changes = []
    media = set()
    export_dir = manifest_file.parent.resolve()
    if output.exists():
        raise ValueError("Choose a new output directory")
    with tempfile.TemporaryDirectory(prefix=".yixing-photo-batch-", dir=output.parent) as temporary:
        packet = Path(temporary) / "packet"
        proposals = packet / "v1/photo-batches"
        proposals.mkdir(parents=True, mode=0o700)
        packet.chmod(0o700)
        photos = packet / "v1/media"
        photos.mkdir(mode=0o700)
        for pot_id in sorted(board):
            gallery = groups[pot_id]["photos"]
            if len(board[pot_id]) != len(gallery):
                raise ValueError(f"Gallery length changed for {pot_id}")
            for slot, (current, selected) in enumerate(zip(board[pot_id], gallery)):
                filename = f"{pot_id}/{slot + 1:02}.jpg"
                if selected["order"] != slot + 1 or selected["filename"] != filename:
                    raise ValueError(f"Unexpected photo order for {pot_id}")
                path = (export_dir / filename).resolve()
                if path.parent != export_dir / pot_id:
                    raise ValueError(f"Export escapes the expected directory for {pot_id}")
                corrected = jpeg(path)
                original = jpeg(originals[selected["sourceId"]])
                corrected_sha = sha256(corrected)
                original_sha = sha256(original)
                if corrected_sha != selected["sha256"]:
                    raise ValueError(f"Export does not match reviewed SHA for {filename}")
                before = {key: current[key] for key in ("role", "sha256", "originalSha256")}
                validate_role(before["role"])
                for key in ("sha256", "originalSha256"):
                    if not re.fullmatch(r"[a-f0-9]{64}", before[key]):
                        raise ValueError(f"Invalid board photo SHA for {pot_id}")
                validate_role(selected["role"])
                after = {"role": selected["role"], "sha256": corrected_sha,
                         "originalSha256": original_sha}
                hold = (pot_id, selected["sourceId"])
                if hold in holds:
                    if hold in matched_holds:
                        raise ValueError(f"Held source appears in more than one slot for {pot_id}")
                    matched_holds.add(hold)
                if before == after:
                    continue
                change = {"potId": pot_id, "slot": slot, "before": before, "after": after}
                if hold in holds:
                    change["needsReview"] = True
                changes.append(change)
                for digest, data in ((corrected_sha, corrected), (original_sha, original)):
                    if digest not in media:
                        (photos / f"{digest}.jpg").write_bytes(data)
                        media.add(digest)

        if holds != matched_holds:
            raise ValueError("A held photo does not match a selected source on its pot")
        proposal = {"intakeSha256": sha256(manifest), "changes": changes, "holdsVersion": 1,
                    "holds": [{"potId": pot, "sourceId": source} for pot, source in sorted(holds)]}
        # Bind the owner's selection to the complete comparison and its review exceptions.
        proposal["id"] = sha256(json.dumps(proposal, sort_keys=True, separators=(",", ":")).encode())
        (proposals / "proposal.json").write_text(json.dumps(proposal, indent=2) + "\n")
        packet.rename(output)
    return {"id": proposal["id"], "photos": len(changes),
            "pots": len({change["potId"] for change in changes}), "jpegObjects": len(media),
            "needsReview": [{"potId": change["potId"], "slot": change["slot"]}
                            for change in changes if change.get("needsReview")]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--board", required=True, type=Path,
                        help="Private current Yixing board JSON (initial snapshot or effective owner gallery)")
    parser.add_argument("--intake", required=True, type=Path, help="Root of the reviewed intake folder")
    parser.add_argument("--holds", required=True, type=Path,
                        help='Versioned private review holds: {"version":1,"holds":[{"potId":"…","sourceId":"…"}]}')
    parser.add_argument("--output", required=True, type=Path,
                        help="New directory in which to stage private R2 objects")
    args = parser.parse_args()
    intake = args.intake.resolve()
    try:
        report = build(args.board, intake / "outputs/WebStore corrected photos/manifest.json",
                       intake / "work/source.json", intake, args.holds, args.output)
    except (KeyError, OSError, TypeError, ValueError) as error:
        parser.exit(1, f"Batch preparation failed: {error}\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
