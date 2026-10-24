"""Bounded offline Poppler/Tesseract adapter. Input remains untouched; no network or model key.

Outputs a source_import payload, not a claim of editorial validation. The server
checks the original hash, fills only missing pages, and retains the source PDF.
"""
import argparse
import base64
import csv
import hashlib
import io
import json
import re
import subprocess
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def command(args, timeout=60):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout


def prepare(path, language):
    data = path.read_bytes()
    if not data.startswith(b'%PDF-') or len(data) > 8 * 1024 * 1024:
        raise ValueError('Forneça PDF de até 8 MiB.')
    if not re.fullmatch(r'[a-z]{3}(?:\+[a-z]{3})*', language):
        raise ValueError('Use códigos Tesseract, por exemplo por+eng.')
    info = command(['pdfinfo', str(path)], 15)
    pages = int(re.search(r'^Pages:\s+(\d+)', info, re.M).group(1))
    if pages > 30:
        raise ValueError('OCR local limitado a 30 páginas por preparação; divida em segmentos identificados.')
    version = command(['tesseract', '--version'], 10).splitlines()[0]
    prepared = []
    with tempfile.TemporaryDirectory(prefix='araread-ocr-') as temp:
        for page in range(1, pages + 1):
            # Never overwrite a textual page using OCR guesses.
            existing = command(['pdftotext', '-f', str(page), '-l', str(page), str(path), '-'], 15)
            if existing.strip():
                continue
            prefix = str(Path(temp) / 'page')
            command(['pdftoppm', '-f', str(page), '-l', str(page), '-singlefile', '-scale-to', '2400', '-png', str(path), prefix], 45)
            tsv = command(['tesseract', prefix + '.png', 'stdout', '-l', language, '--psm', '3', 'tsv'], 60)
            groups = defaultdict(list)
            for row in csv.DictReader(io.StringIO(tsv), delimiter='\t'):
                if row['level'] == '5' and row['text'].strip():
                    groups[(row['block_num'], row['par_num'])].append(row)
            blocks, confidences = [], []
            for words in groups.values():
                confidences.extend(max(0, float(w['conf'])) for w in words)
                left = min(int(w['left']) for w in words)
                top = min(int(w['top']) for w in words)
                right = max(int(w['left']) + int(w['width']) for w in words)
                bottom = max(int(w['top']) + int(w['height']) for w in words)
                blocks.append({'text': ' '.join(w['text'] for w in words), 'bbox': [left, top, right, bottom]})
            prepared.append({'page': page, 'confidence': sum(confidences) / len(confidences) if confidences else 0, 'blocks': blocks})
    return {'format': 'pdf', 'filename': path.name, 'file_base64': base64.b64encode(data).decode('ascii'), 'retain_original': True,
            'ocr': {'source_sha256': hashlib.sha256(data).hexdigest(), 'engine': 'tesseract', 'engine_version': version,
                    'language': language, 'prepared_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'pages': prepared}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--language', default='por+eng')
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve() or args.output.exists():
        parser.error('O destino precisa ser novo e diferente do original.')
    result = prepare(args.input.resolve(), args.language)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'prepared_pages': len(result['ocr']['pages']), 'engine': result['ocr']['engine_version'],
                      'limit': 'OCR não revisado; matemática, tabelas e imagens requerem conferência.'}, ensure_ascii=False))
