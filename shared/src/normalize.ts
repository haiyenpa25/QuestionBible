/**
 * Chuẩn hoá tiếng Việt cho câu hỏi gõ đáp án (Điền câu gốc / Tên riêng Kinh Thánh)
 * Ví dụ: "Phi-e-rơ", "phie ro", "phiero" đều khớp với nhau.
 */

export function removeVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Chuẩn hoá chuỗi giữ khoảng trắng đơn (hữu ích cho cụm từ điền câu gốc)
 */
export function normalizeAnswerText(input: string): string {
  return removeVietnameseDiacritics(input)
    .toLowerCase()
    .replace(/[-_.,!?;:'"()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuẩn hoá chuỗi bỏ cả khoảng trắng và gạch nối (hữu ích cho tên riêng phiên âm như Phi-e-rơ = phiero)
 */
export function normalizeCompactText(input: string): string {
  return normalizeAnswerText(input).replace(/\s+/g, '');
}

/**
 * Bảng tên riêng Kinh Thánh tương đương phổ biến (Tin Lành 1925 / cách gõ tắt)
 */
const BIBLE_NAME_ALIASES: Record<string, string[]> = {
  'moise': ['moise', 'mose', 'moses'],
  'apraham': ['apraham', 'abraham'],
  'davit': ['davit', 'david'],
  'phiero': ['phiero', 'phero', 'peter', 'simonphiero'],
  'phaolo': ['phaolo', 'paulo', 'paul', 'saulo'],
  'giang': ['giang', 'gioan', 'john'],
  'mathio': ['mathio', 'matthieu', 'matthew'],
  'mac': ['mac', 'marco', 'mark'],
  'luca': ['luca', 'luke'],
  'giexu': ['giexu', 'giesu', 'jesus', 'chuagiexu', 'chuagiesu'],
  'gierusalem': ['gierusalem', 'jerusalem'],
  'betlehem': ['betlehem', 'bethlehem'],
  'noe': ['noe', 'noah'],
  'giona': ['giona', 'jonah'],
  'danien': ['danien', 'daniel'],
  'ghideon': ['ghideon', 'ghedeon', 'gideon'],
  'salomon': ['salomon', 'solomon']
};

/**
 * So khớp mềm câu trả lời người chơi nhập với danh sách đáp án chấp nhận
 */
export function isTextAnswerMatch(userAnswer: string, acceptedAnswers: string[]): boolean {
  if (!userAnswer || !userAnswer.trim()) return false;

  const userNorm = normalizeAnswerText(userAnswer);
  const userCompact = normalizeCompactText(userAnswer);

  for (const rawTarget of acceptedAnswers) {
    // Cho phép 1 option chứa nhiều cách viết cách nhau bởi dấu | hoặc ;
    const variants = rawTarget.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
    for (const variant of variants) {
      const targetNorm = normalizeAnswerText(variant);
      const targetCompact = normalizeCompactText(variant);

      if (!targetNorm) continue;
      if (userNorm === targetNorm || userCompact === targetCompact) {
        return true;
      }

      // Kiểm tra bảng tên riêng tương đương
      for (const group of Object.values(BIBLE_NAME_ALIASES)) {
        if (group.includes(targetCompact) && group.includes(userCompact)) {
          return true;
        }
      }
    }
  }

  return false;
}

const BIBLE_HEROES = [
  'Đa-vít',
  'Môi-se',
  'Ghê-đê-ôn',
  'Đa-ni-ên',
  'Ê-xơ-tê',
  'Ru-tơ',
  'Giô-suê',
  'Ê-li',
  'Sa-mu-ên',
  'Phi-e-rơ',
  'Phao-lô',
  'Giăng',
  'Ti-mô-thê',
  'Ba-na-ba',
  'Đê-bô-ra',
  'Nô-ê',
  'Áp-ra-ham',
  'Giô-sép',
  'Nê-hê-mi',
  'Ê-sai'
];

const BIBLE_VIRTUES = [
  'Dũng Cảm',
  'Trung Tín',
  'Khôn Ngoan',
  'Yêu Thương',
  'Khiêm Nhường',
  'Vững Vàng',
  'Vui Mừng',
  'Bình An',
  'Nhịn Nhục',
  'Nhân Từ',
  'Hiền Lành',
  'Tỉnh Thức',
  'Sốt Sắng',
  'Kiên Trì'
];

export function generateBibleNickname(): string {
  const hero = BIBLE_HEROES[Math.floor(Math.random() * BIBLE_HEROES.length)];
  const virtue = BIBLE_VIRTUES[Math.floor(Math.random() * BIBLE_VIRTUES.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${hero} ${virtue} ${num}`.slice(0, 30);
}

