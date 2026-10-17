export function createDoorAudio(soundElement) {
  let audioContext;
  let audioBuffer;
  let activeSource;

  async function prepare() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || window.location.protocol === "file:") return;
    try {
      audioContext = new AudioContextClass();
      const response = await fetch(soundElement.src, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Door sound HTTP ${response.status}`);
      audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.warn("Using the door audio element:", error);
    }
  }

  function stop() {
    soundElement.pause();
    soundElement.currentTime = 0;
    if (activeSource) {
      try { activeSource.stop(); } catch {}
      activeSource = null;
    }
  }

  async function start() {
    if (audioContext && audioBuffer) {
      return audioContext.resume().then(() => {
        if (activeSource) { try { activeSource.stop(); } catch {} }
        activeSource = audioContext.createBufferSource();
        activeSource.buffer = audioBuffer;
        activeSource.connect(audioContext.destination);
        const startsAt = audioContext.currentTime + 0.02;
        activeSource.start(startsAt);
        return () => Math.max(0, (audioContext.currentTime - startsAt) * 1000);
      }).catch((error) => {
        console.warn("Door sound could not play:", error);
        const startedAt = performance.now();
        return () => performance.now() - startedAt;
      });
    }
    soundElement.currentTime = 0;
    let playback;
    try { playback = soundElement.play(); } catch (error) { playback = Promise.reject(error); }
    return Promise.resolve(playback).catch((error) =>
      console.warn("Door sound could not play:", error)).then(() => {
        const startedAt = performance.now();
        return () => performance.now() - startedAt;
      });
  }

  return { prepare, start, stop };
}
