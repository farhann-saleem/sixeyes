import copy
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from timeline_stitch import render

class TimelineTests(unittest.TestCase):
    def worker(self):
        calls = []
        def key(k, _):
            if not isinstance(k, str) or '://' in k or k.startswith('/'):
                raise ValueError('R2 key required')
            return k
        def ffmpeg(args):
            calls.append(args)
            Path(args[-1]).write_bytes(b'fake output')
        return SimpleNamespace(_integer=lambda inp,k,d,lo,hi:inp.get(k,d), _key=key,
            _download=lambda key,p:p.write_bytes(b'source'), _disk=lambda p:None,
            _probe=lambda p:{'streams':[{'codec_type':'audio'}]}, _ffmpeg=ffmpeg, THREADS=4, calls=calls)
    def plan(self):
        return {'width':1280,'height':720,'fps':30,'timeline':{'version':1,'duration':8,
            'slices':[{'kind':'video','key':'a.mp4','start':2,'duration':4,'texts':[]},
                      {'kind':'image','key':'b.jpg','start':0,'duration':4,'texts':[{'text':"owner's: [words] %",'x':.5,'y':.8,'font_size':48,'color':'#ffffff'}]}],
            'audio':[{'key':'voice.mp3','start':1,'duration':7,'delay':1,'volume':.8}]}}
    def test_cloud_commands_preserve_trim_still_text_and_audio(self):
        worker=self.worker()
        with tempfile.TemporaryDirectory() as tmp:
            out,meta=render(self.plan(),Path(tmp),worker)
            self.assertTrue(out.exists()); self.assertEqual(meta['timeline_version'],1)
            self.assertIn('-ss',worker.calls[0]);self.assertIn('-loop',worker.calls[1])
            self.assertIn('expansion=none',worker.calls[1][worker.calls[1].index('-vf')+1])
            self.assertNotIn("owner's",' '.join(worker.calls[1]))
            mix=worker.calls[-1][worker.calls[-1].index('-filter_complex')+1]
            self.assertIn('atrim=start=1:duration=7',mix);self.assertIn('adelay=1000',mix)
    def test_invalid_plans_fail_before_processing(self):
        for mutate in [lambda p:p['timeline'].update(duration=91),
                       lambda p:p['timeline']['slices'][0].update(key='https://bad.example/a'),
                       lambda p:p['timeline']['slices'][0].update(start=float('nan')),
                       lambda p:p['timeline']['slices'][1]['texts'][0].update(color='red:movie=evil'),
                       lambda p:p['timeline'].update(duration=9)]:
            p=copy.deepcopy(self.plan());mutate(p);w=self.worker()
            with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):render(p,Path(tmp),w)
            self.assertFalse(w.calls)
if __name__=='__main__':unittest.main()
