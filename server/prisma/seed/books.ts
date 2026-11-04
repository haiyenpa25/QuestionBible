export interface BibleBookSeed {
  id: number;
  nameVi: string;
  abbrVi: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

/**
 * Danh mục 66 sách Kinh Điển Tin Lành (39 Cựu Ước + 27 Tân Ước)
 * Theo phiên âm Bản Truyền Thống 1925
 */
export const BIBLE_BOOKS_66: BibleBookSeed[] = [
  // CỰU ƯỚC (39 sách)
  { id: 1, nameVi: 'Sáng Thế Ký', abbrVi: 'Sáng', testament: 'OT', chapters: 50 },
  { id: 2, nameVi: 'Xuất Ê-díp-tô Ký', abbrVi: 'Xuất', testament: 'OT', chapters: 40 },
  { id: 3, nameVi: 'Lê-vi Ký', abbrVi: 'Lê', testament: 'OT', chapters: 27 },
  { id: 4, nameVi: 'Dân Số Ký', abbrVi: 'Dân', testament: 'OT', chapters: 36 },
  { id: 5, nameVi: 'Phục Truyền Luật Lệ Ký', abbrVi: 'Phục', testament: 'OT', chapters: 34 },
  { id: 6, nameVi: 'Giô-suê', abbrVi: 'Giô', testament: 'OT', chapters: 24 },
  { id: 7, nameVi: 'Các Quan Xét', abbrVi: 'Quan', testament: 'OT', chapters: 21 },
  { id: 8, nameVi: 'Ru-tơ', abbrVi: 'Ru', testament: 'OT', chapters: 4 },
  { id: 9, nameVi: 'I Sa-mu-ên', abbrVi: '1Sa', testament: 'OT', chapters: 31 },
  { id: 10, nameVi: 'II Sa-mu-ên', abbrVi: '2Sa', testament: 'OT', chapters: 24 },
  { id: 11, nameVi: 'I Các Vua', abbrVi: '1Vua', testament: 'OT', chapters: 22 },
  { id: 12, nameVi: 'II Các Vua', abbrVi: '2Vua', testament: 'OT', chapters: 25 },
  { id: 13, nameVi: 'I Sử Ký', abbrVi: '1Sử', testament: 'OT', chapters: 29 },
  { id: 14, nameVi: 'II Sử Ký', abbrVi: '2Sử', testament: 'OT', chapters: 36 },
  { id: 15, nameVi: 'Exơ-ra', abbrVi: 'Exr', testament: 'OT', chapters: 10 },
  { id: 16, nameVi: 'Nê-hê-mi', abbrVi: 'Nêh', testament: 'OT', chapters: 13 },
  { id: 17, nameVi: 'Ê-xơ-tê', abbrVi: 'Êxt', testament: 'OT', chapters: 10 },
  { id: 18, nameVi: 'Gióp', abbrVi: 'Gióp', testament: 'OT', chapters: 42 },
  { id: 19, nameVi: 'Thi Thiên', abbrVi: 'Thi', testament: 'OT', chapters: 150 },
  { id: 20, nameVi: 'Châm Ngôn', abbrVi: 'Châm', testament: 'OT', chapters: 31 },
  { id: 21, nameVi: 'Truyền Đạo', abbrVi: 'Truyền', testament: 'OT', chapters: 12 },
  { id: 22, nameVi: 'Nhã Ca', abbrVi: 'Nhã', testament: 'OT', chapters: 8 },
  { id: 23, nameVi: 'Ê-sai', abbrVi: 'Ês', testament: 'OT', chapters: 66 },
  { id: 24, nameVi: 'Giê-rê-mi', abbrVi: 'Giê', testament: 'OT', chapters: 52 },
  { id: 25, nameVi: 'Ca Thương', abbrVi: 'Ca', testament: 'OT', chapters: 5 },
  { id: 26, nameVi: 'Ê-xê-chi-ên', abbrVi: 'Êx', testament: 'OT', chapters: 48 },
  { id: 27, nameVi: 'Đa-ni-ên', abbrVi: 'Đa', testament: 'OT', chapters: 12 },
  { id: 28, nameVi: 'Ô-sê', abbrVi: 'Ôs', testament: 'OT', chapters: 14 },
  { id: 29, nameVi: 'Giô-ên', abbrVi: 'Giôên', testament: 'OT', chapters: 3 },
  { id: 30, nameVi: 'A-mốt', abbrVi: 'Am', testament: 'OT', chapters: 9 },
  { id: 31, nameVi: 'Áp-đia', abbrVi: 'Áp', testament: 'OT', chapters: 1 },
  { id: 32, nameVi: 'Giô-na', abbrVi: 'Giôna', testament: 'OT', chapters: 4 },
  { id: 33, nameVi: 'Mi-chê', abbrVi: 'Mi', testament: 'OT', chapters: 7 },
  { id: 34, nameVi: 'Na-hum', abbrVi: 'Na', testament: 'OT', chapters: 3 },
  { id: 35, nameVi: 'Ha-ba-cúc', abbrVi: 'Ha', testament: 'OT', chapters: 3 },
  { id: 36, nameVi: 'Sô-phô-ni', abbrVi: 'Sô', testament: 'OT', chapters: 3 },
  { id: 37, nameVi: 'A-ghê', abbrVi: 'Agh', testament: 'OT', chapters: 2 },
  { id: 38, nameVi: 'Xa-cha-ri', abbrVi: 'Xa', testament: 'OT', chapters: 14 },
  { id: 39, nameVi: 'Ma-la-chi', abbrVi: 'Mal', testament: 'OT', chapters: 4 },

  // TÂN ƯỚC (27 sách)
  { id: 40, nameVi: 'Ma-thi-ơ', abbrVi: 'Mat', testament: 'NT', chapters: 28 },
  { id: 41, nameVi: 'Mác', abbrVi: 'Mác', testament: 'NT', chapters: 16 },
  { id: 42, nameVi: 'Lu-ca', abbrVi: 'Lu', testament: 'NT', chapters: 24 },
  { id: 43, nameVi: 'Giăng', abbrVi: 'Giăng', testament: 'NT', chapters: 21 },
  { id: 44, nameVi: 'Công Vụ Các Sứ Đồ', abbrVi: 'Công', testament: 'NT', chapters: 28 },
  { id: 45, nameVi: 'Rô-ma', abbrVi: 'Rô', testament: 'NT', chapters: 16 },
  { id: 46, nameVi: 'I Cô-rinh-tô', abbrVi: '1Cô', testament: 'NT', chapters: 16 },
  { id: 47, nameVi: 'II Cô-rinh-tô', abbrVi: '2Cô', testament: 'NT', chapters: 13 },
  { id: 48, nameVi: 'Ga-la-ti', abbrVi: 'Ga', testament: 'NT', chapters: 6 },
  { id: 49, nameVi: 'Ê-phê-sô', abbrVi: 'Êph', testament: 'NT', chapters: 6 },
  { id: 50, nameVi: 'Phi-líp', abbrVi: 'Phil', testament: 'NT', chapters: 4 },
  { id: 51, nameVi: 'Cô-lô-se', abbrVi: 'Côl', testament: 'NT', chapters: 4 },
  { id: 52, nameVi: 'I Tê-sa-lô-ni-ca', abbrVi: '1Tê', testament: 'NT', chapters: 5 },
  { id: 53, nameVi: 'II Tê-sa-lô-ni-ca', abbrVi: '2Tê', testament: 'NT', chapters: 3 },
  { id: 54, nameVi: 'I Ti-mô-thê', abbrVi: '1Ti', testament: 'NT', chapters: 6 },
  { id: 55, nameVi: 'II Ti-mô-thê', abbrVi: '2Ti', testament: 'NT', chapters: 4 },
  { id: 56, nameVi: 'Tít', abbrVi: 'Tít', testament: 'NT', chapters: 3 },
  { id: 57, nameVi: 'Phi-lê-môn', abbrVi: 'Plm', testament: 'NT', chapters: 1 },
  { id: 58, nameVi: 'Hê-bơ-rơ', abbrVi: 'Hê', testament: 'NT', chapters: 13 },
  { id: 59, nameVi: 'Gia-cơ', abbrVi: 'Gia', testament: 'NT', chapters: 5 },
  { id: 60, nameVi: 'I Phi-e-rơ', abbrVi: '1Phi', testament: 'NT', chapters: 5 },
  { id: 61, nameVi: 'II Phi-e-rơ', abbrVi: '2Phi', testament: 'NT', chapters: 3 },
  { id: 62, nameVi: 'I Giăng', abbrVi: '1Gi', testament: 'NT', chapters: 5 },
  { id: 63, nameVi: 'II Giăng', abbrVi: '2Gi', testament: 'NT', chapters: 1 },
  { id: 64, nameVi: 'III Giăng', abbrVi: '3Gi', testament: 'NT', chapters: 1 },
  { id: 65, nameVi: 'Giu-đe', abbrVi: 'Giu', testament: 'NT', chapters: 1 },
  { id: 66, nameVi: 'Khải Huyền', abbrVi: 'Khải', testament: 'NT', chapters: 22 }
];

