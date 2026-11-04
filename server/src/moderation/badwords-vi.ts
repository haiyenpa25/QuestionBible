import { removeVietnameseDiacritics } from '@questionbible/shared';

/**
 * Bộ lọc từ cấm tiếng Việt đã hiệu chỉnh theo mục 3.2 (#11) & 6.6 của roadmaps.md:
 * 1. Tách riêng nhóm từ viết tắt / tục rõ ràng (kiểm tra trên chuỗi bỏ dấu, dùng [.\-+_*] đã escape dấu gạch ngang).
 * 2. Nhóm từ có nghĩa kép trong tiếng Việt (lớn/lồn, các/cặc, buổi/buồi, đèo/đéo, đàm/đạm...):
 *    CHỈ kiểm tra trên chữ có dấu chuẩn NFC để không bao giờ chặn nhầm tên thật:
 *    "Đàm Vĩnh Hưng", "Minh Đạm", "Bé Lớn", "Các bạn trẻ", "Buổi sáng", "Đêm Thánh", "Bưởi", "Đèo Cả", "Vol 2".
 */

// Nhóm 1: Các cụm từ tục hoặc viết tắt tục (đã escape dấu \- trong character class)
const ASCII_BAD_PATTERNS: RegExp[] = [
  /(?:^|\s)d[\s.\-+_*]*m(?=$|\s)/i,
  /(?:^|\s)d[\s.\-+_*]*c[\s.\-+_*]*m(?=$|\s)/i,
  /(?:^|\s)v[\s.\-+_*]*l(?=$|\s)/i,
  /(?:^|\s)v[\s.\-+_*]*c[\s.\-+_*]*l(?=$|\s)/i,
  /(?:^|\s)c[\s.\-+_*]*c(?=$|\s)/i,
  /\bd\s*i\s*t\s*m\s*e\b/i,
  /\bd\s*u\s*m\s*a\b/i,
  /\bc\s*h\s*o\s*d\s*e\b/i,
  /\bm\s*a\s*t\s*d\s*a\s*y\b/i,
  /\bk\s*h\s*o\s*n\s*n\s*a\s*n\b/i,
  /\bf\s*u\s*c\s*k/i,
  /\bs\s*h\s*i\s*t/i,
  /\bb\s*i\s*t\s*c\s*h/i
];

// Nhóm 2: Các từ đơn tiếng Việt có từ đồng âm khác dấu (chỉ chặn khi viết đúng dấu tục hoặc không dấu đứng riêng kiểu tục)
const UNICODE_TONED_BAD_PATTERNS: RegExp[] = [
  /(?:^|\s)lồn(?=$|\s)/iu,
  /(?:^|\s)cặc(?=$|\s)/iu,
  /(?:^|\s)buồi(?=$|\s)/iu,
  /(?:^|\s)đéo(?=$|\s)/iu,
  /(?:^|\s)địt(?=$|\s)/iu,
  /(?:^|\s)đụ(?=$|\s)/iu,
  /(?:^|\s)đĩ(?=$|\s)/iu
];

export function containsProfanityVi(text: string): boolean {
  if (!text) return false;

  const nfc = text.normalize('NFC').toLowerCase();
  for (const regex of UNICODE_TONED_BAD_PATTERNS) {
    if (regex.test(nfc)) {
      return true;
    }
  }

  const ascii = removeVietnameseDiacritics(nfc)
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o');

  for (const regex of ASCII_BAD_PATTERNS) {
    if (regex.test(ascii)) {
      return true;
    }
  }

  return false;
}

/**
 * Chuẩn hoá biệt danh để so sánh trùng tên (mục 6.4 roadmaps.md):
 * Bỏ ký tự vô hình (zero-width), bỏ dấu tiếng Việt, viết thường, gộp khoảng trắng.
 */
export function normalizeNicknameKey(nickname: string): string {
  const withoutZeroWidth = (nickname ?? '').replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, '');
  return removeVietnameseDiacritics(withoutZeroWidth)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateNickname(rawNickname: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  // Bỏ ký tự điều khiển, zero-width, thẻ HTML và giới hạn 20 ký tự hiển thị gọn trên màn chiếu (mục 6.4)
  const sanitized = (rawNickname ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

  if (sanitized.length < 2) {
    return {
      valid: false,
      sanitized,
      error: 'Biệt danh phải có ít nhất 2 ký tự.'
    };
  }

  if (containsProfanityVi(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: 'Biệt danh chứa từ ngữ không phù hợp với sinh hoạt Hội Thánh. Vui lòng chọn tên khác.'
    };
  }

  return { valid: true, sanitized };
}
