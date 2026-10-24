"""Fixture sintética autorizada; não é citação nem material de usuário."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import fitz

out = Path('tests/fixtures')
out.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(out / 'synthetic-extraction.pdf'), pagesize=A4, invariant=1)
c.setTitle('AraRead - synthetic extraction fixture')
c.setFont('Helvetica-Bold', 18)
c.drawString(50, 780, 'Synthetic document - page with text')
c.setFont('Helvetica', 12)
c.drawString(50, 740, 'Hypothesis: a value may be associated with another.')
c.drawString(50, 715, 'Association is not a proof of causation.')
c.drawString(50, 670, 'Table: group | sample | condition')
c.drawString(50, 645, 'A | 12 | synthetic observations only')
c.drawString(50, 610, 'Figure 1: a triangle drawn for illustration, not a proof.')
c.line(70, 470, 170, 470)
c.line(170, 470, 120, 560)
c.line(120, 560, 70, 470)
c.setFont('Helvetica', 10)
c.drawString(50, 400, 'Note 1: extraction order, tables and images need checking.')
c.showPage()
# Sem texto: o importador deve declarar a falta, nunca fabricar transcrição.
c.setStrokeColorRGB(.1, .3, .2)
c.circle(220, 500, 120)
c.line(70, 350, 440, 350)
c.showPage()
c.save()
document = fitz.open(str(out / 'synthetic-extraction.pdf'))
Path('.local/pdf-review').mkdir(parents=True, exist_ok=True)
for i, page in enumerate(document):
    page.get_pixmap(matrix=fitz.Matrix(1, 1)).save(f'.local/pdf-review/page-{i+1}.png')
print(f'Fixture de {len(document)} páginas criada e renderizada por MuPDF.')
