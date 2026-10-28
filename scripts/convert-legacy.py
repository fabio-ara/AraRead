"""Invoked only in the networkless converter container; no shell expansion."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=90, check=False)
    if result.returncode:
        raise RuntimeError('O conversor não conseguiu processar o documento.')
    return result.stdout.decode('utf-8', errors='replace').strip()

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('doc', 'mobi'):
        raise RuntimeError('Use doc ou mobi para o arquivo montado em /input/source.')
    kind = sys.argv[1]
    source = Path('/input/source.' + kind)
    raw = source.read_bytes()
    if not 0 < len(raw) <= 8 * 1024 * 1024:
        raise RuntimeError('O original precisa ter até 8 MiB.')
    if kind == 'doc' and raw[:8] != bytes.fromhex('d0cf11e0a1b11ae1'):
        raise RuntimeError('O arquivo não é um documento binário OLE reconhecido.')
    if kind == 'mobi' and raw[60:68] not in (b'BOOKMOBI', b'TEXtREAd'):
        raise RuntimeError('O arquivo não é um contêiner MOBI/PalmDoc reconhecido.')
    Path('/tmp/araread-runtime').mkdir(mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='araread-conversion-') as tmp:
        tmp = Path(tmp)
        if kind == 'doc':
            profile = tmp / 'profile'
            (profile / 'user').mkdir(parents=True)
            (profile / 'user' / 'registrymodifications.xcu').write_text(
                '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry">'
                '<item oor:path="/org.openoffice.Office.Common/Security/Scripting">'
                '<prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>'
                '</item></oor:items>', encoding='utf-8')
            version = run(['soffice', '--version'])
            run(['soffice', '-env:UserInstallation=' + profile.as_uri(), '--headless',
                 '--norestore', '--convert-to', 'docx:Office Open XML Text',
                 '--outdir', str(tmp), str(source)])
            converted, tool, extension = tmp / 'source.docx', 'LibreOffice', 'docx'
        else:
            version = run(['ebook-convert', '--version'])
            converted, tool, extension = tmp / 'source.epub', 'calibre', 'epub'
            run(['ebook-convert', str(source), str(converted)])
        output = converted.read_bytes()
        if not 0 < len(output) <= 8 * 1024 * 1024:
            raise RuntimeError('O convertido excede o limite de 8 MiB.')
        Path('/output/converted.' + extension).write_bytes(output)
        Path('/output/provenance.json').write_text(json.dumps({
            'tool': tool, 'version': version, 'format': kind, 'converted_format': extension,
            'original_sha256': hashlib.sha256(raw).hexdigest(),
            'converted_sha256': hashlib.sha256(output).hexdigest(),
            'limits': 'Conversão local sem rede; ordem e fidelidade exigem confronto com o original.'
        }, ensure_ascii=False), encoding='utf-8')
    print('Conversão concluída; original e proveniência serão preservados no preparo.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Converter output and source text never become logs.
        print('Falha na conversão local: ' + str(error)[:300], file=sys.stderr)
        sys.exit(1)
