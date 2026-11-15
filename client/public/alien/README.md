# Nemi voice clips

No ElevenLabs key is configured. The game uses subtitles and, where available,
the device's speech voice after a user gesture. There are no runtime voice API calls.

To add ElevenLabs later, generate original character speech outside the browser
using the exact lines in `shared/src/alien.ts`. Save the clips here, then set
`voice.json` to `{"provider":"elevenlabs","clips":{"hello":"hello.mp3",...}}`.
Supported line keys: hello, accepted, delivery, clean, ready, complete, wrong.
Only local filenames ending in mp3, wav or ogg are accepted. Keep captions and
clips in agreement. Rebuild to include clips in the offline cache.

Never put API keys in this folder, voice.json, VITE variables or Git. Use a private
environment variable in an authoring script when generation is explicitly requested.
