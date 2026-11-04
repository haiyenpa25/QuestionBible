import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BIBLE_BOOKS_66 } from './books.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu khởi tạo dữ liệu mẫu QuestionBible...');

  // 1. Seed 66 sách Kinh Thánh Tin Lành
  for (const book of BIBLE_BOOKS_66) {
    await prisma.bibleBook.upsert({
      where: { id: book.id },
      update: {
        nameVi: book.nameVi,
        abbrVi: book.abbrVi,
        testament: book.testament,
        chapters: book.chapters
      },
      create: book
    });
  }
  console.log('✅ Đã nạp 66 sách Kinh Thánh Tin Lành (39 Cựu Ước, 27 Tân Ước).');

  // 2. Seed tài khoản mặc định
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const editorPassword = await bcrypt.hash('Editor@123', 10);
  const hostPassword = await bcrypt.hash('Host@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@questionbible.vn' },
    update: {},
    create: {
      email: 'admin@questionbible.vn',
      passwordHash: adminPassword,
      displayName: 'Quản Trị Viên',
      churchName: 'Hội Thánh Tin Lành Việt Nam',
      role: 'admin'
    }
  });

  const editor = await prisma.user.upsert({
    where: { email: 'giaoduc@questionbible.vn' },
    update: {},
    create: {
      email: 'giaoduc@questionbible.vn',
      passwordHash: editorPassword,
      displayName: 'Ban Cơ Đốc Giáo Dục',
      churchName: 'Hội Thánh Tin Lành Việt Nam',
      role: 'editor'
    }
  });

  const host = await prisma.user.upsert({
    where: { email: 'host@questionbible.vn' },
    update: {},
    create: {
      email: 'host@questionbible.vn',
      passwordHash: hostPassword,
      displayName: 'Người Dẫn Chương Trình',
      churchName: 'Ban Thanh Niên Hội Thánh',
      role: 'host'
    }
  });

  console.log('✅ Đã tạo tài khoản mẫu: admin@questionbible.vn / giaoduc@questionbible.vn / host@questionbible.vn');

  // 3. Seed Tags (Chủ đề)
  const tagNames = [
    'Nhân vật',
    'Phép lạ',
    'Ngụ ngôn',
    'Lễ hội',
    'Địa danh',
    'Câu gốc',
    'Giáo lý căn bản',
    'Cựu Ước',
    'Tân Ước',
    'Giáng Sinh',
    'Phục Sinh',
    'Thiếu nhi'
  ];

  const tagMap = new Map<string, number>();
  for (const name of tagNames) {
    const t = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    tagMap.set(name, t.id);
  }

  // Kiểm tra nếu đã có bộ câu hỏi mẫu thì không tạo trùng
  const existingQuizzes = await prisma.quiz.count();
  if (existingQuizzes > 0) {
    console.log(`ℹ️ Đã có ${existingQuizzes} bộ câu hỏi trong CSDL, bỏ qua bước tạo quiz mẫu.`);
    return;
  }

  // 4. Tạo Bộ câu hỏi 1: Hành Trình Cựu Ước (Đủ các loại câu hỏi: quiz, true_false, type_answer, order, slider)
  const otQuiz = await prisma.quiz.create({
    data: {
      ownerId: editor.id,
      title: 'Hành Trình Cựu Ước: Từ Sáng Thế Đến Các Tiên Tri',
      description:
        'Bộ câu hỏi tổng hợp kiến thức Cựu Ước Kinh Thánh Tin Lành (Bản Truyền Thống 1925) với đầy đủ các dạng câu hỏi: Trắc nghiệm, Đúng/Sai, Điền câu gốc, Sắp xếp thứ tự và Thanh trượt.',
      audience: 'all',
      visibility: 'public',
      status: 'approved',
      questions: {
        create: [
          {
            position: 1,
            type: 'quiz',
            content: 'Ai đã vâng lời Đức Chúa Trời đóng một chiếc tàu lớn bằng cây gô-phe để tránh cơn nước lụt?',
            timeLimit: 20,
            pointsFactor: 1,
            bookId: 1,
            chapter: 6,
            verseFrom: 14,
            verseTo: 14,
            verseText:
              'Ngươi hãy đóng một chiếc tàu bằng cây gô-phe, đóng có từng phòng, rồi trét chai cả trong lẫn ngoài.',
            explanation:
              'Nô-ê đã tìm được ơn trước mặt Đức Giê-hô-va và hoàn toàn vâng lời Ngài dù người đời xung quanh chê cười.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Áp-ra-ham', isCorrect: false },
                { position: 1, content: 'Nô-ê', isCorrect: true },
                { position: 2, content: 'Môi-se', isCorrect: false },
                { position: 3, content: 'Đa-vít', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Nhân vật')! }, { tagId: tagMap.get('Cựu Ước')! }]
            }
          },
          {
            position: 2,
            type: 'true_false',
            content: 'Tiên tri Giô-na đã ở trong bụng một con cá lớn ba ngày và ba đêm.',
            timeLimit: 15,
            pointsFactor: 1,
            bookId: 32,
            chapter: 1,
            verseFrom: 17,
            verseTo: 17,
            verseText:
              'Đức Giê-hô-va sắm sẵn một con cá lớn đặng nuốt Giô-na; Giô-na ở trong bụng cá ba ngày và ba đêm.',
            explanation:
              'Trong bụng cá, Giô-na đã ăn năn cầu nguyện cùng Đức Giê-hô-va và được Ngài giải cứu để đi rao giảng tại thành Ni-ni-ve.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Đúng', isCorrect: true },
                { position: 1, content: 'Sai', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Phép lạ')! }, { tagId: tagMap.get('Cựu Ước')! }]
            }
          },
          {
            position: 3,
            type: 'quiz',
            content: 'Đức Chúa Trời đã ban Mười Điều Răn cho Môi-se trên ngọn núi nào?',
            timeLimit: 20,
            pointsFactor: 1,
            bookId: 2,
            chapter: 19,
            verseFrom: 20,
            verseTo: 20,
            verseText:
              'Đức Giê-hô-va giáng lâm trên chót núi Si-na-i, Ngài đòi Môi-se lên chót núi, thì Môi-se bèn lên.',
            explanation:
              'Tại núi Si-na-i, Đức Chúa Trời lập giao ước với dân Y-sơ-ra-ên và ban luật pháp để dạy họ sống thánh khiết.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: 'Núi Cạt-mên', isCorrect: false },
                { position: 1, content: 'Núi Si-na-i', isCorrect: true },
                { position: 2, content: 'Núi Ô-li-ve', isCorrect: false },
                { position: 3, content: 'Núi Nê-bô', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Địa danh')! }, { tagId: tagMap.get('Cựu Ước')! }]
            }
          },
          {
            position: 4,
            type: 'type_answer',
            content:
              'Điền từ còn thiếu trong Thi Thiên 23:1: "Đức Giê-hô-va là Đấng ___ tôi; tôi sẽ chẳng thiếu thốn gì."',
            timeLimit: 25,
            pointsFactor: 1,
            bookId: 19,
            chapter: 23,
            verseFrom: 1,
            verseTo: 1,
            verseText: 'Đức Giê-hô-va là Đấng chăn giữ tôi; tôi sẽ chẳng thiếu thốn gì.',
            explanation:
              'Thi Thiên 23 của vua Đa-vít khẳng định sự chăm sóc trọn vẹn, dẫn dắt và bảo vệ của Chúa như Người Chăn hiền lành.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: 'chăn giữ|chan giu|chăn dắt', isCorrect: true }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Câu gốc')! }, { tagId: tagMap.get('Cựu Ước')! }]
            }
          },
          {
            position: 5,
            type: 'order',
            content: 'Sắp xếp 4 sách đầu tiên của Ngũ Kinh Môi-se theo đúng thứ tự trong Kinh Thánh:',
            timeLimit: 30,
            pointsFactor: 1,
            bookId: 1,
            chapter: 1,
            verseFrom: 1,
            verseTo: 1,
            verseText: 'Ban đầu Đức Chúa Trời dựng nên trời đất.',
            explanation:
              'Năm sách Ngũ Kinh của Môi-se theo thứ tự: Sáng Thế Ký, Xuất Ê-díp-tô Ký, Lê-vi Ký, Dân Số Ký, Phục Truyền Luật Lệ Ký.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: 'Sáng Thế Ký', isCorrect: true },
                { position: 1, content: 'Xuất Ê-díp-tô Ký', isCorrect: true },
                { position: 2, content: 'Lê-vi Ký', isCorrect: true },
                { position: 3, content: 'Dân Số Ký', isCorrect: true }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Cựu Ước')! }]
            }
          },
          {
            position: 6,
            type: 'slider',
            content: 'Theo Sáng Thế Ký, ông Mê-tu-sê-la (người sống thọ nhất trong Kinh Thánh) hưởng thọ bao nhiêu tuổi?',
            timeLimit: 25,
            pointsFactor: 2,
            bookId: 1,
            chapter: 5,
            verseFrom: 27,
            verseTo: 27,
            verseText: 'Vậy, trọn đời Mê-tu-sê-la là chín trăm sáu mươi chín tuổi, rồi người qua đời.',
            explanation:
              'Mê-tu-sê-la sống 969 năm. Tên của ông cũng gắn liền với lời cảnh báo về sự phán xét của cơn Đại Hồng Thủy.',
            difficulty: 3,
            sliderMin: 800,
            sliderMax: 1000,
            sliderAnswer: 969,
            sliderTolerance: 5,
            options: {
              create: [{ position: 0, content: '969', isCorrect: true }]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Nhân vật')! }, { tagId: tagMap.get('Cựu Ước')! }]
            }
          },
          {
            position: 7,
            type: 'quiz',
            content: 'Quan xét Ghê-đê-ôn đã cùng bao nhiêu chiến sĩ tinh nhuệ đánh bại đạo quân Ma-đi-an đông như châu chấu?',
            timeLimit: 20,
            pointsFactor: 1,
            bookId: 7,
            chapter: 7,
            verseFrom: 7,
            verseTo: 7,
            verseText:
              'Đức Giê-hô-va phán cùng Ghê-đê-ôn rằng: Ấy là nhờ ba trăm người đã liếm nước mà ta sẽ giải cứu các ngươi.',
            explanation:
              'Chúa giảm quân số từ 32.000 xuống còn 300 người để dân Y-sơ-ra-ên biết rằng chiến thắng đến từ quyền năng Chúa chứ không phải sức riêng.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: '120 người', isCorrect: false },
                { position: 1, content: '300 người', isCorrect: true },
                { position: 2, content: '1.000 người', isCorrect: false },
                { position: 3, content: '3.000 người', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Nhân vật')! }, { tagId: tagMap.get('Phép lạ')! }]
            }
          },
          {
            position: 8,
            type: 'quiz',
            content: 'Ai đã can đảm nói: "Nếu tôi phải chết, thì tôi chết!" khi bước vào chầu vua để cứu dân Do Thái?',
            timeLimit: 20,
            pointsFactor: 2,
            bookId: 17,
            chapter: 4,
            verseFrom: 16,
            verseTo: 16,
            verseText:
              'Hãy đi nhóm hiệp các người Giu-đa có mặt tại Su-sơ, và hãy vì tôi kiêng ăn... đoạn, tôi sẽ vào cùng vua, là việc trái luật pháp; nếu tôi phải chết, thì tôi chết!',
            explanation:
              'Hoàng hậu Ê-xơ-tê đã nhờ cậy sự cầu nguyện kiêng ăn của dân sự và sẵn sàng hy sinh mạng sống để giải cứu dân tộc mình.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: 'Ru-tơ', isCorrect: false },
                { position: 1, content: 'Đê-bô-ra', isCorrect: false },
                { position: 2, content: 'Ê-xơ-tê', isCorrect: true },
                { position: 3, content: 'An-ne', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Nhân vật')! }, { tagId: tagMap.get('Cựu Ước')! }]
            }
          }
        ]
      }
    }
  });

  // 5. Tạo Bộ câu hỏi 2: Cuộc Đời Chúa Giê-xu & Hội Thánh Đầu Tiên (Tân Ước)
  const ntQuiz = await prisma.quiz.create({
    data: {
      ownerId: editor.id,
      title: 'Tân Ước: Cuộc Đời Chúa Giê-xu & Hội Thánh Đầu Tiên',
      description:
        'Khám phá bốn sách Phúc Âm và Công Vụ Các Sứ Đồ: những lời phán, phép lạ của Chúa Cứu Thế Giê-xu và hành trình truyền giáo.',
      audience: 'youth',
      visibility: 'public',
      status: 'approved',
      questions: {
        create: [
          {
            position: 1,
            type: 'quiz',
            content: 'Chúa Giê-xu đã làm phép lạ đầu tiên (hóa nước thành rượu) tại tiệc cưới ở đâu?',
            timeLimit: 20,
            pointsFactor: 1,
            bookId: 43,
            chapter: 2,
            verseFrom: 11,
            verseTo: 11,
            verseText:
              'Ấy là tại Ca-na, trong xứ Ga-li-lê, mà Đức Chúa Jêsus đã làm phép lạ thứ nhất nầy, và tỏ vinh hiển của mình ra; môn đồ Ngài bèn tin Ngài.',
            explanation:
              'Phép lạ tại Ca-na bày tỏ vinh hiển của Chúa Giê-xu và củng cố đức tin cho các môn đồ đầu tiên.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Bết-lê-hem', isCorrect: false },
                { position: 1, content: 'Ca-na xứ Ga-li-lê', isCorrect: true },
                { position: 2, content: 'Ca-bê-na-um', isCorrect: false },
                { position: 3, content: 'Bê-tha-ni', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Phép lạ')! }, { tagId: tagMap.get('Tân Ước')! }]
            }
          },
          {
            position: 2,
            type: 'type_answer',
            content:
              'Điền từ còn thiếu trong Giăng 3:16: "Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban ___ của Ngài..."',
            timeLimit: 25,
            pointsFactor: 1,
            bookId: 43,
            chapter: 3,
            verseFrom: 16,
            verseTo: 16,
            verseText:
              'Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con một của Ngài, hầu cho hễ ai tin Con ấy không bị hư mất mà được sự sống đời đời.',
            explanation:
              'Giăng 3:16 là "Phúc Âm thu nhỏ", tóm tắt tình yêu cứu chuộc vĩ đại của Đức Chúa Trời dành cho nhân loại.',
            difficulty: 1,
            options: {
              create: [{ position: 0, content: 'Con một|Con Độc Sanh', isCorrect: true }]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Câu gốc')! }, { tagId: tagMap.get('Giáo lý căn bản')! }]
            }
          },
          {
            position: 3,
            type: 'order',
            content: 'Sắp xếp 4 sách Phúc Âm theo đúng thứ tự trong Kinh Thánh Tân Ước:',
            timeLimit: 25,
            pointsFactor: 1,
            bookId: 40,
            chapter: 1,
            verseFrom: 1,
            verseTo: 1,
            verseText: 'Gia phổ Đức Chúa Jêsus Christ, con cháu Đa-vít và con cháu Áp-ra-ham.',
            explanation:
              'Bốn sách Phúc Âm gồm Ma-thi-ơ, Mác, Lu-ca và Giăng, ghi lại cuộc đời, chức vụ, sự chết và sự sống lại của Chúa Giê-xu.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Ma-thi-ơ', isCorrect: true },
                { position: 1, content: 'Mác', isCorrect: true },
                { position: 2, content: 'Lu-ca', isCorrect: true },
                { position: 3, content: 'Giăng', isCorrect: true }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Tân Ước')! }]
            }
          },
          {
            position: 4,
            type: 'quiz',
            content: 'Câu phán: "Ta là đường đi, lẽ thật, và sự sống; chẳng bởi ta thì không ai được đến cùng Cha" được chép ở sách nào?',
            timeLimit: 20,
            pointsFactor: 1,
            bookId: 43,
            chapter: 14,
            verseFrom: 6,
            verseTo: 6,
            verseText:
              'Đức Chúa Jêsus đáp rằng: Ta là đường đi, lẽ thật, và sự sống; chẳng bởi ta thì không ai được đến cùng Cha.',
            explanation:
              'Chúa Giê-xu khẳng định Ngài là con đường duy nhất dẫn con người trở về hòa thuận với Đức Chúa Trời.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: 'Ma-thi-ơ 11:28', isCorrect: false },
                { position: 1, content: 'Giăng 14:6', isCorrect: true },
                { position: 2, content: 'Công Vụ 4:12', isCorrect: false },
                { position: 3, content: 'Rô-ma 5:8', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Câu gốc')! }, { tagId: tagMap.get('Giáo lý căn bản')! }]
            }
          },
          {
            position: 5,
            type: 'true_false',
            content: 'Trong ngày Lễ Ngũ Tuần, sau bài giảng của sứ đồ Phi-e-rơ, có khoảng 3.000 người tin Chúa và chịu báp-têm.',
            timeLimit: 15,
            pointsFactor: 1,
            bookId: 44,
            chapter: 2,
            verseFrom: 41,
            verseTo: 41,
            verseText:
              'Vậy, những kẻ nhận lời đó đều chịu phép báp-têm; và trong ngày ấy, có độ ba ngàn người thêm vào Hội thánh.',
            explanation:
              'Đức Thánh Linh giáng lâm trong ngày Lễ Ngũ Tuần đã ban quyền năng cho các sứ đồ làm chứng và khai sinh Hội Thánh đầu tiên.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Đúng', isCorrect: true },
                { position: 1, content: 'Sai', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Lễ hội')! }, { tagId: tagMap.get('Tân Ước')! }]
            }
          },
          {
            position: 6,
            type: 'quiz',
            content: 'Sứ đồ Phao-lô và Si-la đã làm gì vào lúc nửa đêm khi bị cầm tù và cùm chân tại thành Phi-líp?',
            timeLimit: 20,
            pointsFactor: 2,
            bookId: 44,
            chapter: 16,
            verseFrom: 25,
            verseTo: 25,
            verseText:
              'Lối nửa đêm, Phao-lô và Si-la đương cầu nguyện và hát ngợi khen Đức Chúa Trời; các tù phạm đều nghe.',
            explanation:
              'Dù chịu đòn vọt và xiềng xích, Phao-lô và Si-la vẫn cầu nguyện và hát ngợi khen Chúa, dẫn đến việc người đề lao và cả nhà ông tin nhận Chúa.',
            difficulty: 2,
            options: {
              create: [
                { position: 0, content: 'Tìm cách tháo xiềng trốn thoát', isCorrect: false },
                { position: 1, content: 'Cầu nguyện và hát ngợi khen Đức Chúa Trời', isCorrect: true },
                { position: 2, content: 'Viết thư cầu cứu Hội Thánh Giê-ru-sa-lem', isCorrect: false },
                { position: 3, content: 'Tranh luận với người đề lao', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Nhân vật')! }, { tagId: tagMap.get('Tân Ước')! }]
            }
          }
        ]
      }
    }
  });

  // 6. Tạo Bộ câu hỏi 3: Đố Kinh Thánh Thiếu Nhi (Chế độ Thiếu Nhi)
  const kidsQuiz = await prisma.quiz.create({
    data: {
      ownerId: host.id,
      title: 'Thiếu Nhi Học Lời Chúa: Những Anh Hùng Đức Tin Nhỏ Tuổi',
      description:
        'Bộ câu hỏi vui nhộn, dễ hiểu dành cho các em thiếu nhi Trường Chúa Nhật và Thánh Kinh Mùa Hè.',
      audience: 'kids',
      visibility: 'public',
      status: 'approved',
      questions: {
        create: [
          {
            position: 1,
            type: 'quiz',
            content: 'Chàng chăn chiên nhỏ tuổi Đa-vít đã dùng vũ khí gì để chiến thắng tên khổng lồ Gô-li-át?',
            timeLimit: 25,
            pointsFactor: 1,
            bookId: 9,
            chapter: 17,
            verseFrom: 49,
            verseTo: 49,
            verseText:
              'Đa-vít thò tay vào bao, lấy một hòn đá, dùng trành ném nó trúng vào trán Gô-li-át.',
            explanation:
              'Đa-vít chiến thắng không phải nhờ gươm giáo nhưng nhờ danh Đức Giê-hô-va vạn quân.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Thanh gươm vàng của vua Sau-lơ', isCorrect: false },
                { position: 1, content: 'Cây trành và hòn đá suối', isCorrect: true },
                { position: 2, content: 'Cung tên sắt', isCorrect: false },
                { position: 3, content: 'Ngựa chiến và xe binh', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Thiếu nhi')! }, { tagId: tagMap.get('Nhân vật')! }]
            }
          },
          {
            position: 2,
            type: 'quiz',
            content: 'Cậu bé đã dâng cho Chúa Giê-xu mấy cái bánh và mấy con cá để Chúa hóa ra nuôi 5.000 người ăn no?',
            timeLimit: 25,
            pointsFactor: 1,
            bookId: 43,
            chapter: 6,
            verseFrom: 9,
            verseTo: 9,
            verseText:
              'Ở đây có một đứa trẻ có năm cái bánh mạch nha và hai con cá; song có bấy nhiêu thì thấm vào đâu cho đến đỗi đông người nầy!',
            explanation:
              'Khi các em sẵn lòng dâng những gì nhỏ bé của mình cho Chúa, Chúa sẽ làm nên công việc lớn lao.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: '2 cái bánh và 5 con cá', isCorrect: false },
                { position: 1, content: '5 cái bánh và 2 con cá', isCorrect: true },
                { position: 2, content: '7 cái bánh và 3 con cá', isCorrect: false },
                { position: 3, content: '12 cái bánh và 2 con cá', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Thiếu nhi')! }, { tagId: tagMap.get('Phép lạ')! }]
            }
          },
          {
            position: 3,
            type: 'true_false',
            content: 'Chúa Giê-xu đã sinh ra tại chuồng chiên máng cỏ ở thành Bết-lê-hem.',
            timeLimit: 20,
            pointsFactor: 1,
            bookId: 42,
            chapter: 2,
            verseFrom: 7,
            verseTo: 7,
            verseText:
              'Người sanh con trai đầu lòng, lấy khăn bọc con mình, đặt nằm trong máng cỏ, vì nhà quán không có đủ chỗ ở.',
            explanation:
              'Con Đức Chúa Trời đã hạ mình giáng sinh nơi máng cỏ đơn sơ để đem sự cứu rỗi đến cho mọi người.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Đúng', isCorrect: true },
                { position: 1, content: 'Sai', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Thiếu nhi')! }, { tagId: tagMap.get('Giáng Sinh')! }]
            }
          },
          {
            position: 4,
            type: 'quiz',
            content: 'Ai đã bị ném vào hang sư tử vì vẫn trung tín cầu nguyện cùng Đức Chúa Trời mỗi ngày 3 lần?',
            timeLimit: 25,
            pointsFactor: 2,
            bookId: 27,
            chapter: 6,
            verseFrom: 22,
            verseTo: 22,
            verseText:
              'Đức Chúa Trời tôi đã sai thiên sứ Ngài bịt miệng sư tử, nên nó không làm hại gì cho tôi.',
            explanation:
              'Đa-ni-ên giữ vững đời sống cầu nguyện trong mọi hoàn cảnh và được Đức Chúa Trời giải cứu kỳ diệu.',
            difficulty: 1,
            options: {
              create: [
                { position: 0, content: 'Đa-ni-ên', isCorrect: true },
                { position: 1, content: 'Giô-sép', isCorrect: false },
                { position: 2, content: 'Sa-mu-ên', isCorrect: false },
                { position: 3, content: 'Ê-li', isCorrect: false }
              ]
            },
            questionTags: {
              create: [{ tagId: tagMap.get('Thiếu nhi')! }, { tagId: tagMap.get('Nhân vật')! }]
            }
          }
        ]
      }
    }
  });

  console.log(`✅ Đã khởi tạo 3 bộ câu hỏi mẫu (#${otQuiz.id}, #${ntQuiz.id}, #${kidsQuiz.id}).`);
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi seed dữ liệu:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

