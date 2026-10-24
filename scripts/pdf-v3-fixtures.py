"""Synthetic acceptance material, no quotations or reader data."""
from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
import fitz

out = Path('tests/fixtures')
c = canvas.Canvas(str(out / 'synthetic-columns.pdf'), pagesize=(600, 800), invariant=1)
for page in range(1, 3):
    c.setFont('Helvetica', 9)
    c.drawString(40, 775, 'Synthetic journal - running header')
    c.drawString(290, 20, str(page))
    c.setFont('Helvetica-Bold', 18)
    c.drawString(40, 730, 'A conditional argument' if page == 1 else 'Limits of the argument')
    c.setFont('Helvetica', 10)
    for col, x in [('Left', 40), ('Right', 325)]:
        for i in range(4):
            y = 680 - i * 70
            c.drawString(x, y, f'{col} paragraph {i + 1}: a hypothesis may apply,')
            c.drawString(x, y - 14, 'but does not establish a necessary conclusion.')
            c.drawString(x, y - 28, 'Its condition must remain explicit.')
    c.setFont('Helvetica', 8)
    c.drawString(40, 90, 'Note 1: this is a synthetic example, not an author quotation.')
    c.showPage()
c.save()

img = Image.new('RGB', (1600, 900), 'white')
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 42)
except OSError:
    font = ImageFont.truetype('DejaVuSans.ttf', 42)
for i, line in enumerate(['Synthetic scanned page', 'A hypothesis may explain an observation.', 'It does not prove a necessary conclusion.', 'This condition must not be omitted.']):
    draw.text((90, 120 + i * 120), line, font=font, fill='black')
buffer = BytesIO()
img.save(buffer, format='PNG')
c = canvas.Canvas(str(out / 'synthetic-scanned.pdf'), pagesize=(600, 800), invariant=1)
c.drawImage(ImageReader(buffer), 0, 230, width=600, height=338)
c.showPage()
c.save()
review = Path('.local/pdf-review')
c = canvas.Canvas(str(out / 'synthetic-structure.pdf'), pagesize=(600, 800), invariant=1)
c.setFont('Helvetica-Bold', 18)
c.drawString(40, 740, 'Synthetic conditional model')
c.setFont('Helvetica', 11)
c.drawString(40, 690, 'A condition is required. The equation does not assert causation.')
c.drawString(40, 640, 'x = 2; x != 0')
for row, cells in enumerate([['Case', 'Condition', 'Conclusion'], ['A', 'x != 0', 'Conditional'], ['B', 'x = 0', 'Not applicable']]):
    for x, cell in zip([40, 230, 420], cells):
        c.drawString(x, 560 - row * 28, cell)
c.line(35, 540, 550, 540)
c.setFont('Helvetica', 8)
c.drawString(40, 90, 'Note: synthetic mathematics, no quotation or empirical claim.')
c.save()
review.mkdir(exist_ok=True, parents=True)
for name in ['synthetic-columns', 'synthetic-scanned', 'synthetic-structure']:
    doc = fitz.open(str(out / f'{name}.pdf'))
    doc[0].get_pixmap().save(str(review / f'{name}.png'))
print('Three synthetic PDFs generated; previews rendered with MuPDF.')
