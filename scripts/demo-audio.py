"""Development audio only. PYTHONPATH=.local-runtime/tts-tools python scripts/demo-audio.py"""
import asyncio, json
from pathlib import Path
import edge_tts
from mutagen.mp3 import MP3

clips = {
    'library': 'أَنَا أَقْرَأُ كِتَابًا فِي الْمَكْتَبَةِ.',
    'school': 'يَذْهَبُ أَحْمَدُ إِلَى الْمَدْرَسَةِ صَبَاحًا.',
    'book': 'هَذَا كِتَابٌ.',
    'pen': 'هَذَا قَلَمٌ.',
    'heart': 'قَلْبٌ',
    'dog': 'كَلْبٌ',
    'water': 'أَشْرَبُ الْمَاءَ.',
    'desk': 'الْكِتَابُ عَلَى الْمَكْتَبِ.',
    'teacher': 'أَنَا مُعَلِّمٌ.',
}
async def main():
    folder = Path('public/media/demo-arabic'); folder.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, text in clips.items():
        target = folder / (name + '.mp3')
        if not target.exists():
            await edge_tts.Communicate(text, 'ar-SA-HamedNeural', rate='-15%').save(str(target))
        manifest[name] = {'url': '/media/demo-arabic/' + name + '.mp3', 'duration': MP3(target).info.length, 'transcript': text}
        print(name, round(manifest[name]['duration'], 2), flush=True)
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
asyncio.run(main())
