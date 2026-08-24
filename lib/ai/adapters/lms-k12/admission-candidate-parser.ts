export interface ParsedCandidateReference {
  fullName?: string;
  mobile?: string;
  enquiryNo?: string;
  standard?: string;
  ordinal?: number;
}

export function parseCandidateReference(
  message: string,
  fallback: Partial<ParsedCandidateReference> = {},
): ParsedCandidateReference {
  const text = message.trim();

  const mobileMatch = text.match(/\b[6-9]\d{9}\b/);

  const enquiryMatch = text.match(
    /(?:enquiry|inquiry)(?:\s*(?:no|number|id))?\s*[:#-]?\s*([a-z0-9/-]+)/i,
  );

  const standardMatch = text.match(
    /(?:standard|std|grade|class)\s*[:#-]?\s*([a-z0-9]+)/i,
  );

  const ordinalMap: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
  };

  const ordinalEntry = Object.entries(ordinalMap).find(([word]) =>
    new RegExp(`\\b${word}\\b`, "i").test(text),
  );

  let fullName = text
    .replace(/\bfull\s*name\s*[:#-]?/gi, "")
    .replace(/\bmobile(?:\s*(?:no|number))?\s*[:#-]?\s*\d+/gi, "")
    .replace(
      /\b(?:standard|std|grade|class)\s*[:#-]?\s*[a-z0-9]+/gi,
      "",
    )
    .replace(
      /\b(?:enquiry|inquiry)(?:\s*(?:no|number|id))?\s*[:#-]?\s*[a-z0-9/-]+/gi,
      "",
    )
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (fullName.length < 2 || /^(yes|no|confirm|do it)$/i.test(fullName)) {
    fullName = "";
  }

  return {
    fullName: fullName || fallback.fullName,
    mobile: mobileMatch?.[0] ?? fallback.mobile,
    enquiryNo: enquiryMatch?.[1] ?? fallback.enquiryNo,
    standard: standardMatch?.[1] ?? fallback.standard,
    ordinal: ordinalEntry?.[1],
  };
}
