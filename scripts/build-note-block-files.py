"""Collect installed Minecraft note-block audio and decode WAVs with vgmstream."""
import argparse
import array
import hashlib
import json
import os
from pathlib import Path
import subprocess
import wave
import zipfile


def build(minecraft_dir, version, vgmstream, output):
    version_file = minecraft_dir / "versions" / version / (version + ".json")
    game = json.loads(version_file.read_text(encoding="utf-8"))
    asset_id = game["assetIndex"]["id"]
    index = json.loads((minecraft_dir / "assets" / "indexes" / (asset_id + ".json")).read_text(encoding="utf-8"))["objects"]

    def asset_bytes(name):
        info = index[name]
        source = minecraft_dir / "assets" / "objects" / info["hash"][:2] / info["hash"]
        data = source.read_bytes()
        if len(data) != info["size"] or hashlib.sha1(data).hexdigest() != info["hash"]:
            raise ValueError("Asset integrity check failed: " + name)
        return data

    definitions = json.loads(asset_bytes("minecraft/sounds.json"))
    events = {name: value for name, value in definitions.items() if name.startswith("block.note_block.")}

    def resolve(event, pitch=1, seen=()):
        if event in seen:
            raise ValueError("Cyclic sound event: " + event)
        results = []
        for sound in definitions[event].get("sounds", []):
            sound = {"name": sound} if isinstance(sound, str) else sound
            name = sound["name"].removeprefix("minecraft:")
            rate = pitch * sound.get("pitch", 1)
            if sound.get("type", "file") == "event":
                results.extend(resolve(name, rate, seen + (event,)))
            else:
                results.append(("minecraft/sounds/" + name + ".ogg", rate))
        return results

    labels = {
        "harp": "Harp / piano", "basedrum": "Bass drum", "bass": "Bass guitar",
        "hat": "Hi-hat", "cow_bell": "Cow bell", "iron_xylophone": "Iron xylophone",
        "trumpet_exposed": "Exposed trumpet", "trumpet_weathered": "Weathered trumpet",
        "trumpet_oxidized": "Oxidized trumpet", "ender_dragon": "Ender dragon",
        "wither_skeleton": "Wither skeleton"
    }
    title = lambda name: labels.get(name, name.replace("_", " ").capitalize())
    records = []
    used = set()
    for event in sorted(events):
        key = event.removeprefix("block.note_block.")
        is_mob = key.startswith("imitate.")
        name = key.removeprefix("imitate.")
        group = "mob-heads" if is_mob else "instruments"
        sources = resolve(event)
        for number, (source, pitch) in enumerate(sources, 1):
            suffix = "/" + Path(source).stem if is_mob or len(sources) > 1 else ""
            slug = name.replace("_", "-") + suffix
            records.append({
                "id": group + "/" + slug,
                "label": title(name) + (" " + str(number) if len(sources) > 1 else ""),
                "group": group, "event": event, "asset": source, "event_pitch": pitch
            })
            used.add(source)
    for source in sorted(index):
        if source.startswith("minecraft/sounds/note/") and source.endswith(".ogg") and source not in used:
            name = Path(source).stem
            records.append({
                "id": "alternates/" + name, "label": "Alternate " + name,
                "group": "alternates", "asset": source, "event_pitch": 1
            })
            used.add(source)

    report = subprocess.run([str(vgmstream), "-h"], capture_output=True, text=True)
    if report.returncode not in (0, 1) or not report.stdout.startswith("vgmstream CLI decoder"):
        raise RuntimeError("Unable to read the vgmstream version: " + report.stderr)
    tool_version = report.stdout.splitlines()[0]
    output.mkdir(parents=True, exist_ok=True)
    for record in records:
        relative = Path(record["id"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Invalid output path")
        ogg = output / "ogg" / relative.with_suffix(".ogg")
        wav = output / "wav" / relative.with_suffix(".wav")
        ogg.parent.mkdir(parents=True, exist_ok=True)
        wav.parent.mkdir(parents=True, exist_ok=True)
        ogg.write_bytes(asset_bytes(record["asset"]))
        subprocess.run([str(vgmstream), "-i", "-o", str(wav), str(ogg)], check=True, capture_output=True, text=True)
        with wave.open(str(wav), "rb") as audio:
            record.update({
                "sample_rate": audio.getframerate(), "channels": audio.getnchannels(),
                "frames": audio.getnframes(), "duration": round(audio.getnframes() / audio.getframerate(), 6)
            })
            if audio.getsampwidth() != 2:
                raise ValueError("Expected decoded PCM16 WAV: " + record["id"])
            samples = array.array("h", audio.readframes(audio.getnframes()))
            if not samples or not any(samples):
                raise ValueError("Empty or silent audio: " + record["id"])
        record.update({
            "ogg": ogg.relative_to(output).as_posix(), "wav": wav.relative_to(output).as_posix(),
            "source_sha1": index[record["asset"]]["hash"],
            "ogg_bytes": ogg.stat().st_size, "wav_bytes": wav.stat().st_size,
            "wav_sha256": hashlib.sha256(wav.read_bytes()).hexdigest()
        })

    instruments = sum(record["group"] == "instruments" for record in records)
    mob_clips = sum(record["group"] == "mob-heads" for record in records)
    alternates = sum(record["group"] == "alternates" for record in records)
    if set(index[name]["hash"] for name in used) != set(record["source_sha1"] for record in records):
        raise ValueError("Incomplete collection")
    catalog = {
        "game": "Minecraft Java Edition", "version": version, "asset_index": asset_id,
        "asset_index_url": game["assetIndex"]["url"],
        "sound_definitions_sha1": index["minecraft/sounds.json"]["hash"],
        "decoder": tool_version, "file_count": len(records),
        "instrument_count": instruments, "mob_clip_count": mob_clips, "alternate_count": alternates,
        "scope": "Original source samples, not separately rendered note pitches.",
        "files": records
    }
    catalog_file = output / "catalog.json"
    catalog_file.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8", newline="\n")
    readme = output / "README.txt"
    readme.write_text(
        f"Minecraft note block source sounds - Java Edition {version}\n\n"
        f"{instruments} instrument samples, {mob_clips} mob-head clips, {alternates} alternate samples.\n"
        "Includes every block.note_block.* sound event and every audio file in sounds/note/.\n\n"
        "OGG files are unchanged copies of the installed game assets; SHA-1 hashes were verified.\n"
        "WAV files are decoded PCM16 audio, produced with:\n" + tool_version + "\n"
        "Command: vgmstream-cli -i -o output.wav input.ogg\n\n"
        "These are base recordings, not separately rendered note pitches. The game changes\n"
        "playback speed for different notes. The creeper-head event uses its source at half speed.\n"
        "The browser preview applies that event pitch; downloads preserve the source recording.\n"
        "catalog.json records source paths, events, event pitches, formats, and checksums.\n\n"
        "Original game audio belongs to its respective creators. No ownership or new license\n"
        "to the original audio is claimed by this collection.\n"
        "Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.\n",
        encoding="utf-8", newline="\n"
    )
    for format_name in ["ogg", "wav"]:
        archive = output / f"minecraft-note-blocks-java-{version}-{format_name}.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
            for file in [readme, catalog_file, *[output / record[format_name] for record in records]]:
                package.write(file, file.relative_to(output).as_posix())
        with zipfile.ZipFile(archive) as package:
            if package.testzip() is not None:
                raise ValueError("ZIP verification failed")
    print(f"Prepared {len(records)} source sounds: {instruments} instruments, {mob_clips} mob clips, {alternates} alternates.")
    print(tool_version)
    for archive in output.glob("*.zip"):
        print(f"{archive.name}: {archive.stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--minecraft-dir", type=Path, default=Path(os.environ.get("APPDATA", "")) / ".minecraft")
    parser.add_argument("--version", default="26.3")
    parser.add_argument("--vgmstream", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent.parent / "useful-files" / "minecraft-note-blocks")
    args = parser.parse_args()
    build(args.minecraft_dir, args.version, args.vgmstream.resolve(), args.output.resolve())
