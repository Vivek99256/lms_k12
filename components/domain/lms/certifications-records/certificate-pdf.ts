'use client';

import type { LearningCertificate } from './certifications-records-service';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Never expires';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Client-side high-resolution Certificate PDF Generator.
 * Creates an executive-grade A4 landscape certificate of completion using jsPDF.
 */
export async function downloadCertificatePdf(certificate: LearningCertificate): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const width = 297;
  const height = 210;
  const centerX = width / 2;

  // Background subtle cream/white
  doc.setFillColor(254, 254, 255);
  doc.rect(0, 0, width, height, 'F');

  // Outer Decorative Border (Primary Brand: #5846EA / [88, 70, 234])
  doc.setDrawColor(88, 70, 234);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, width - 20, height - 20);

  // Inner Border (Soft Indigo: #C7D2FE / [199, 210, 254])
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.4);
  doc.rect(13, 13, width - 26, height - 26);

  // Corner Accent Flourishes
  const corners = [
    { x: 10, y: 10 },
    { x: width - 10, y: 10 },
    { x: 10, y: height - 10 },
    { x: width - 10, y: height - 10 },
  ];
  doc.setFillColor(88, 70, 234);
  corners.forEach(({ x, y }) => {
    doc.rect(x > 100 ? x - 4 : x, y > 100 ? y - 4 : y, 4, 4, 'F');
  });

  // Top Institution Banner
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SCHOLAR SUITE LMS  •  ACADEMIC & PROFESSIONAL CREDENTIAL', centerX, 27, { align: 'center' });

  // Certificate Main Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(30, 27, 75);
  doc.text('CERTIFICATE OF COMPLETION', centerX, 41, { align: 'center' });

  // Ornamental Divider
  doc.setDrawColor(88, 70, 234);
  doc.setLineWidth(0.6);
  doc.line(centerX - 40, 46, centerX + 40, 46);
  doc.setFillColor(88, 70, 234);
  doc.circle(centerX, 46, 1.2, 'F');

  // "This certifies that"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  doc.text('THIS IS PROUDLY PRESENTED TO', centerX, 58, { align: 'center' });

  // Recipient Name
  const recipient = certificate.learner_name || 'Kalpesh Sheth';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(88, 70, 234);
  doc.text(recipient, centerX, 72, { align: 'center' });

  // Employee ID Subtitle
  if (certificate.employee_no) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Employee ID: ${certificate.employee_no}`, centerX, 78, { align: 'center' });
  }

  // Thin underline under recipient
  doc.setDrawColor(224, 231, 255);
  doc.setLineWidth(0.3);
  doc.line(centerX - 55, 81, centerX + 55, 81);

  // Achievement Prose
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'for successfully completing the approved curriculum and demonstrating competency in',
    centerX,
    89,
    { align: 'center' }
  );

  // Course / Credential Title
  const credentialTitle = certificate.name || certificate.course_title || 'Certificate of Achievement';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(credentialTitle, centerX, 100, { align: 'center' });

  // Description / Competencies
  if (certificate.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(certificate.description, 210);
    doc.text(splitDesc, centerX, 109, { align: 'center' });
  }

  // Certificate Metadata Box (Bottom-Left / Center)
  const metaY = 135;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(30, metaY, 150, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CREDENTIAL ID:', 36, metaY + 9);
  doc.text('ISSUED ON:', 36, metaY + 17);
  doc.text('VALID UNTIL:', 36, metaY + 24);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(88, 70, 234);
  doc.text(certificate.certificate_number || 'CERT-2026-0001', 68, metaY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(formatDate(certificate.issued_at), 68, metaY + 17);
  doc.text(formatDate(certificate.expires_at), 68, metaY + 24);

  if (certificate.verification_code) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('VERIFY CODE:', 125, metaY + 9);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(certificate.verification_code, 150, metaY + 9);
  }

  // Certified Gold / Primary Seal Badge (Right side)
  const sealX = 225;
  const sealY = metaY + 14;
  doc.setFillColor(88, 70, 234);
  doc.circle(sealX, sealY, 14, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.circle(sealX, sealY, 12, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SCHOLAR SUITE', sealX, sealY - 3, { align: 'center' });
  doc.setFontSize(8);
  doc.text('VERIFIED', sealX, sealY + 1.5, { align: 'center' });
  doc.setFontSize(6);
  doc.text('EXCELLENCE', sealX, sealY + 5.5, { align: 'center' });

  // Signature Blocks
  const sigY = 180;
  // Left Signature
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(40, sigY, 100, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Academic Director', 70, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('LMS Academic Standards Committee', 70, sigY + 9, { align: 'center' });

  // Right Signature
  doc.line(197, sigY, 257, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Controller of Examinations', 227, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('People & Competency Division', 227, sigY + 9, { align: 'center' });

  // Verification URL Footer
  if (certificate.verification_code) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Credential verification: https://lms.scholarsuite.edu/verify/${certificate.verification_code}`,
      centerX,
      198,
      { align: 'center' }
    );
  }

  // Save the PDF file directly to browser downloads
  const filename = `${certificate.certificate_number || 'certificate'}.pdf`;
  doc.save(filename);
}

