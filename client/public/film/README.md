# Outpost Down · crew dialogue

48 locally synthesized PCM WAV clips for the fictional five-minute opening film.
Vega: Samantha; Imani: Karen; Juno and Mission Control: Daniel (macOS built-in voices).
These are synthetic character voices, not recordings or imitations of NASA personnel.

Authoring script: `scripts/generate-film-audio.ts` (macOS only; needs access to the local speech service).
Script/captions/timing: `client/src/ui/filmStory.ts`.
Audio plays locally in the browser, without a speech API or additional service.
The film's pause, sound, scene controls, visibility handling, and disposal also control dialogue.
`tests/film.test.ts` verifies that every clip contains audio and fits its subtitle window.
