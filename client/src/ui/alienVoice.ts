import { alienLines, type AlienLine } from "../../../shared/src/alien";
import type { Sfx } from "./sound";

type VoiceManifest = { clips?: Partial<Record<AlienLine, string>> };
/** Local recordings take priority. Device speech is optional; subtitles always work. */
export class AlienVoice {
  private manifest: Promise<VoiceManifest>;
  private audio = new Audio();
  private source: MediaElementAudioSourceNode | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  speaking = false;
  mode = "subtitles";
  private serial = 0;
  constructor(private sfx: Sfx) {
    this.manifest = fetch(`${import.meta.env.BASE_URL}alien/voice.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
    });
  }
  private status(text: string) {
    const el = document.querySelector("#alien-voice-status");
    if (el) el.textContent = text;
  }
  private talking(value: boolean) {
    this.speaking = value;
    document.body.classList.toggle("nemi-speaking", value);
    dispatchEvent(
      new CustomEvent("alien-voice", { detail: { speaking: value } }),
    );
  }
  stop() {
    this.serial++;
    this.audio.pause();
    this.audio.onended = this.audio.onerror = null;
    if (this.utterance && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    this.utterance = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.talking(false);
  }
  async speak(line: AlienLine) {
    this.stop();
    const run = this.serial;
    if (this.sfx.muted || this.sfx.volume <= 0 || document.hidden) {
      this.status("Sound off · subtitles on");
      return;
    }
    const manifest = await this.manifest;
    if (run !== this.serial) return;
    const clip = manifest.clips?.[line];
    // Only bundled files are allowed. No browser credentials or external voice requests.
    if (clip && /^[a-zA-Z0-9_-]+\.(mp3|wav|ogg)$/.test(clip)) {
      try {
        await this.sfx.unlock();
        if (run !== this.serial) return;
        if (!this.source && this.sfx.context && this.sfx.master) {
          this.source = this.sfx.context.createMediaElementSource(this.audio);
          this.source.connect(this.sfx.master);
        }
        this.audio.src = `${import.meta.env.BASE_URL}alien/${clip}`;
        this.audio.onended = () => {
          this.talking(false);
          this.status("Subtitles on");
        };
        this.audio.onerror = () => {
          this.talking(false);
          this.status("Voice unavailable · read the subtitles");
        };
        await this.audio.play();
        this.mode = "recorded";
        this.talking(true);
        this.status("Nemi is speaking…");
        return;
      } catch {
        this.status("Tap Listen again for voice");
      }
    }
    if (run !== this.serial) return;
    if (
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined" &&
      window.speechSynthesis.getVoices().length
    ) {
      const utterance = (this.utterance = new SpeechSynthesisUtterance(
        alienLines[line],
      ));
      utterance.rate = 0.93;
      utterance.pitch = 1.25;
      utterance.volume = this.sfx.volume;
      utterance.onstart = () => {
        if (run === this.serial) {
          this.talking(true);
          this.status("Nemi is speaking…");
        }
      };
      utterance.onend = () => {
        if (run === this.serial) {
          this.talking(false);
          this.status("Subtitles on");
        }
      };
      utterance.onerror = () => {
        if (run === this.serial) {
          this.talking(false);
          this.status("Voice unavailable · subtitles on");
        }
      };
      this.mode = "device";
      window.speechSynthesis.speak(utterance);
    } else {
      this.mode = "subtitles";
      this.status("Voice not installed · subtitles on");
      // A brief gesture accompanies the subtitle even on devices without a speech voice.
      this.talking(true);
      this.timer = setTimeout(() => this.talking(false), 2500);
    }
  }
}
