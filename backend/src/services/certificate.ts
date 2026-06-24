import PDFDocument from 'pdfkit';
import type { Writable } from 'stream';
import fs from 'fs';

const NAVY = '#152C5B';
const NAVY_DARK = '#0C1B3A';
const GOLD = '#C8A646';
const GOLD_LIGHT = '#E4CC83';
const CREAM = '#FBF7EC';
const GRAY = '#6E7280';

export interface CertificateArgs {
  studentName: string;
  courseTitle: string;
  instructorName?: string | null;
  tenantName: string;
  logoPath?: string | null;
  completedAt: Date;
  certificateId: string;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Use UTC getters: completedAt comes from a TIMESTAMPTZ column, and reading
// it with local getters would shift the displayed day depending on the
// server's timezone (e.g. midnight UTC rendering as the previous day in UTC-3).
const formatDateEs = (d: Date) => `${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;

/** Draws an n-pointed star path centered at (cx, cy). */
const starPath = (doc: PDFKit.PDFDocument, cx: number, cy: number, outerR: number, innerR: number, points = 5) => {
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  doc.moveTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
  for (let i = 0; i < points * 2; i++) {
    angle += step;
    const r = i % 2 === 0 ? innerR : outerR;
    doc.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  doc.closePath();
};

/** Fits text to a single line within maxWidth by shrinking the font size. */
const fitFontSize = (doc: PDFKit.PDFDocument, text: string, font: string, maxWidth: number, startSize: number, minSize: number) => {
  let size = startSize;
  doc.font(font);
  doc.fontSize(size);
  while (size > minSize && doc.widthOfString(text) > maxWidth) {
    size -= 1;
    doc.fontSize(size);
  }
  return size;
};

export const renderCertificatePdf = (stream: Writable, args: CertificateArgs): void => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  doc.pipe(stream);

  const W = doc.page.width;
  const H = doc.page.height;
  const cx = W / 2;

  // ── Background ──────────────────────────────────────────────
  doc.rect(0, 0, W, H).fill(CREAM);

  // ── Border frame ─────────────────────────────────────────────
  const outer = 26;
  const inner = 42;
  doc.rect(outer, outer, W - outer * 2, H - outer * 2).lineWidth(2.5).stroke(NAVY);
  doc.rect(inner, inner, W - inner * 2, H - inner * 2).lineWidth(1).stroke(GOLD);

  // Gold ribbon stripes top & bottom, between the two border lines
  doc.rect(outer, outer, W - outer * 2, inner - outer).fill(GOLD);
  doc.rect(outer, H - inner, W - outer * 2, inner - outer).fill(GOLD);

  // Corner ornaments (small diamonds) on the inner border corners
  const cornerInset = inner;
  [[cornerInset, cornerInset], [W - cornerInset, cornerInset], [cornerInset, H - cornerInset], [W - cornerInset, H - cornerInset]]
    .forEach(([x, y]) => {
      doc.save();
      doc.translate(x, y).rotate(45);
      doc.rect(-6, -6, 12, 12).fill(GOLD);
      doc.restore();
      doc.circle(x, y, 3).fill(NAVY);
    });

  // ── Letterhead: logo + academy name (top-left) ─────────────
  const headX = inner + 36;
  let headY = inner + 30;
  let logoDrawn = false;
  if (args.logoPath) {
    try {
      if (fs.existsSync(args.logoPath)) {
        doc.image(args.logoPath, headX, headY, { fit: [40, 40] });
        logoDrawn = true;
      }
    } catch {
      // Unsupported format (e.g. SVG/WEBP) — skip the logo, certificate still works.
    }
  }
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13)
    .text(args.tenantName.toUpperCase(), logoDrawn ? headX + 50 : headX, headY + (logoDrawn ? 13 : 0), {
      characterSpacing: 1.5,
    });

  // ── Title block ──────────────────────────────────────────────
  let y = inner + 56;
  doc.fillColor(GRAY).font('Helvetica').fontSize(11)
    .text('CERTIFICADO DE FINALIZACIÓN DE CURSO', 0, y, { width: W, align: 'center', characterSpacing: 3 });

  y += 30;
  doc.fillColor(NAVY).font('Times-Bold').fontSize(34)
    .text('Certificado de Logro', 0, y, { width: W, align: 'center' });

  // Ornamental divider: line - diamond - line
  y += 52;
  const dividerHalf = 90;
  doc.moveTo(cx - dividerHalf, y).lineTo(cx - 10, y).lineWidth(1).stroke(GOLD);
  doc.moveTo(cx + 10, y).lineTo(cx + dividerHalf, y).lineWidth(1).stroke(GOLD);
  doc.save().translate(cx, y).rotate(45).rect(-5, -5, 10, 10).fill(GOLD).restore();

  // ── "Otorgado a" + student name ─────────────────────────────
  y += 26;
  doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(13)
    .text('Se otorga el presente certificado a', 0, y, { width: W, align: 'center' });

  y += 22;
  const nameMaxWidth = W - inner * 2 - 160;
  const nameSize = fitFontSize(doc, args.studentName, 'Times-BoldItalic', nameMaxWidth, 40, 22);
  doc.fillColor(NAVY_DARK).font('Times-BoldItalic').fontSize(nameSize)
    .text(args.studentName, 0, y, { width: W, align: 'center' });

  doc.font('Times-BoldItalic').fontSize(nameSize);
  const nameWidth = doc.widthOfString(args.studentName);
  const nameLineY = y + nameSize + 6;
  doc.moveTo(cx - nameWidth / 2 - 20, nameLineY).lineTo(cx + nameWidth / 2 + 20, nameLineY)
    .lineWidth(1).stroke(GOLD);

  // ── Body: course completion statement ───────────────────────
  y = nameLineY + 22;
  doc.fillColor(GRAY).font('Helvetica').fontSize(13)
    .text('por haber completado satisfactoriamente todas las lecciones del curso', 0, y, {
      width: W, align: 'center',
    });

  y += 24;
  const courseMaxWidth = W - inner * 2 - 200;
  const courseSize = fitFontSize(doc, args.courseTitle, 'Times-Bold', courseMaxWidth, 22, 15);
  doc.fillColor(NAVY).font('Times-Bold').fontSize(courseSize)
    .text(args.courseTitle, inner + 100, y, { width: W - (inner + 100) * 2, align: 'center' });

  if (args.instructorName) {
    y += courseSize + 16;
    doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(12)
      .text(`Dictado por ${args.instructorName}`, 0, y, { width: W, align: 'center' });
  }

  // ── Footer: signature block · seal · date block ─────────────
  const footerY = H - inner - 92;
  const colWidth = 210;

  // Left block — instructor / academy signature
  const leftX = cx - 260;
  doc.moveTo(leftX, footerY + 30).lineTo(leftX + colWidth, footerY + 30).lineWidth(1).stroke(NAVY);
  doc.fillColor(NAVY).font('Times-Italic').fontSize(14)
    .text(args.instructorName || args.tenantName, leftX, footerY, { width: colWidth, align: 'center' });
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
    .text('INSTRUCTOR', leftX, footerY + 36, { width: colWidth, align: 'center', characterSpacing: 1.5 });

  // Right block — completion date
  const rightX = cx + 260 - colWidth;
  doc.moveTo(rightX, footerY + 30).lineTo(rightX + colWidth, footerY + 30).lineWidth(1).stroke(NAVY);
  doc.fillColor(NAVY).font('Times-Italic').fontSize(14)
    .text(formatDateEs(args.completedAt), rightX, footerY, { width: colWidth, align: 'center' });
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
    .text('FECHA DE FINALIZACIÓN', rightX, footerY + 36, { width: colWidth, align: 'center', characterSpacing: 1.5 });

  // Center seal medallion
  const sealCy = footerY + 6;
  doc.save();
  doc.circle(cx, sealCy, 34).fill(GOLD);
  doc.circle(cx, sealCy, 28).fill(NAVY);
  doc.circle(cx, sealCy, 28).lineWidth(1.5).stroke(GOLD_LIGHT);
  starPath(doc, cx, sealCy, 17, 7, 5);
  doc.fill(GOLD);
  // Ribbon tails
  doc.moveTo(cx - 16, sealCy + 26).lineTo(cx - 24, sealCy + 48).lineTo(cx - 6, sealCy + 38).closePath().fill(NAVY);
  doc.moveTo(cx + 16, sealCy + 26).lineTo(cx + 24, sealCy + 48).lineTo(cx + 6, sealCy + 38).closePath().fill(NAVY);
  doc.restore();

  // ── Bottom verification line ─────────────────────────────────
  doc.fillColor(GRAY).font('Helvetica').fontSize(8)
    .text(`Otorgado por ${args.tenantName} a través de Atenea  ·  ID de certificado: ${args.certificateId}`, 0, H - inner - 18, {
      width: W, align: 'center', characterSpacing: 0.5,
    });

  doc.end();
};
