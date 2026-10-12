"""Costruisce la card OuterView del Girasole (solo libreria standard).

Output in rear-card/dist/:
  girasole-rear-card.zip   pacchetto da importare in OuterView
  preview.html             anteprima da PC (dati finti, modificabili)
"""
from pathlib import Path
import io
import json
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
VERSION = '1.0.0'
URI = 'content://it.risto.rear.state/scene'
FIELDS = ['kind', 'top', 'main', 'bottom', 'accent', 'seq']


def archive(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            info = zipfile.ZipInfo(name, (2026, 10, 12, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    return buffer.getvalue()


def main():
    script = (ROOT / 'card.js').read_text(encoding='utf-8')
    if ']]>' in script or '</script' in script.lower():
        raise ValueError('card.js contiene un delimitatore del wrapper')
    types = {'seq': 'int'}
    variables = '\n            '.join(
        f'<Variable name="rr.{f}" type="{types.get(f, "string")}" column="{f}" row="0"/>' for f in FIELDS)
    hosts = '\n        '.join(
        f'<HostVar name="rr.{f}" type="{"number" if types.get(f) == "int" else "string"}"/>' for f in FIELDS)
    manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<Widget version="2" screenWidth="904" frameRate="2" clearCanvas="true">
    <VariableBinders>
        <ContentProviderBinder name="risto_rear" uri="{URI}" columns="{','.join(FIELDS)}" countName="rr.rows">
            {variables}
        </ContentProviderBinder>
    </VariableBinders>
    <Var name="rr.rows" expression="0" const="true"/>
    <ExternalCommands><Trigger action="init,resume"><BinderCommand name="risto_rear" command="refresh"/></Trigger></ExternalCommands>
    <JsCanvas name="girasole_rear_v1" x="0" y="0" w="#view_width" h="#view_height">
        <HostVar name="rr.rows" type="number"/>
        {hosts}
        <Script><![CDATA[
{script}
        ]]></Script>
    </JsCanvas>
</Widget>
'''
    ET.fromstring(manifest)
    description = f'''<?xml version="1.0" encoding="utf-8"?>
<MIUI-Theme><title>Il Girasole</title><designer>Il Girasole</designer><author>Il Girasole</author>
<version>{VERSION}</version><uiVersion>15</uiVersion><description>Tavolo, totale e ultime aggiunte dal gestionale (app Girasole Rear).</description></MIUI-Theme>
'''
    ET.fromstring(description)

    DIST.mkdir(exist_ok=True)
    inner = archive({'manifest.xml': manifest.encode('utf-8')})
    (DIST / 'girasole-rear-card.zip').write_bytes(
        archive({'description.xml': description.encode('utf-8'), 'rearscreen': inner}))

    demo = {'rows': 1, 'kind': 'table', 'top': 'Tavolo 5', 'main': '+1 Margherita',
            'bottom': 'Totale 42,50 €', 'accent': '#34d399', 'seq': 1}
    preview = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Anteprima card Girasole</title>
<style>body{{margin:0;background:#222;display:grid;place-items:center;min-height:100vh;font-family:sans-serif;color:#ccc}}
canvas{{border-radius:28px;max-width:95vw;height:auto}}</style></head><body>
<div><canvas id="c" width="904" height="572"></canvas>
<p>Dati finti: modifica <code>window.data.rr</code> dalla console e chiama <code>GirasoleRearRender()</code>.</p></div>
<script>window.data = {{ rr: {json.dumps(demo, ensure_ascii=False)} }};</script>
<script>
{script}
</script></body></html>
'''
    (DIST / 'preview.html').write_text(preview, encoding='utf-8')
    print(f'ok: {DIST / "girasole-rear-card.zip"}')


if __name__ == '__main__':
    main()
