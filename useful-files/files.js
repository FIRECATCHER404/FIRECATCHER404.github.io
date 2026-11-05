"use strict";

async function loadSounds() {
  const status = document.getElementById("preview-status");
  status.hidden = false;
  try {
    const catalogURL = new URL("minecraft-note-blocks/catalog.json", location.href);
    const response = await fetch(catalogURL);
    if (!response.ok) throw new Error("Sound catalog unavailable");
    const catalog = await response.json();
    const players = [];
    for (const file of catalog.files) {
      const list = document.getElementById(file.group + "-list");
      if (!list) throw new Error("Unknown sound group");
      const card = document.createElement("article");
      card.className = "sound-card";
      const title = document.createElement("h3");
      title.textContent = file.label;
      const filename = document.createElement("p");
      filename.className = "sound-filename";
      filename.textContent = file.ogg.split("/").pop() + " · " + file.duration.toFixed(2) + " s";
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.setAttribute("aria-label", "Preview " + file.label);
      audio.defaultPlaybackRate = file.event_pitch;
      audio.playbackRate = file.event_pitch;
      audio.preservesPitch = false;
      const actions = document.createElement("div");
      actions.className = "sound-actions";
      for (const [format, type] of [["ogg", "audio/ogg"], ["wav", "audio/wav"]]) {
        const url = new URL(file[format], catalogURL);
        const source = document.createElement("source");
        source.src = url.href;
        source.type = type;
        audio.appendChild(source);
        const link = document.createElement("a");
        link.href = url.href;
        link.download = file[format].split("/").pop();
        link.textContent = format.toUpperCase();
        link.setAttribute("aria-label", "Download " + file.label + " as " + format.toUpperCase());
        actions.appendChild(link);
      }
      audio.addEventListener("play", () => {
        for (const other of players) if (other !== audio) other.pause();
      });
      players.push(audio);
      card.append(title, filename, audio, actions);
      list.appendChild(card);
    }
    status.hidden = true;
  } catch (error) {
    status.textContent = "Audio previews couldn't load. You can still download the ZIP files.";
    console.error("Useful files:", error);
  }
}

loadSounds();
