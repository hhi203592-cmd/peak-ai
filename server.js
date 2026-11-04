 import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION =
  'Bạn là PEAK, trợ lý AI thân thiện, hữu ích và trung thực. ' +
  'Trả lời bằng ngôn ngữ người dùng đang sử dụng, ưu tiên tiếng Việt khi phù hợp. ' +
  'Giải thích rõ ràng, không bịa nguồn hoặc khẳng định điều chưa biết. ' +
  'Nếu không chắc, hãy nói rõ mức độ không chắc chắn. ' +
  'Không yêu cầu người dùng cung cấp mật khẩu, API key hoặc thông tin bí mật.';

// Lưu lịch sử hội thoại trong bộ nhớ máy chủ.
const conversations = new Map();
const SESSION_MAX_AGE = 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'PEAK đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau một phút.'
  }
}));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL
  });
});

app.post('/api/chat', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Máy chủ chưa được cấu hình GEMINI_API_KEY.'
    });
  }

  const message = typeof req.body?.message === 'string'
    ? req.body.message.trim()
    : '';

  const previousInteractionId =
    typeof req.body?.previousInteractionId === 'string'
      ? req.body.previousInteractionId.trim()
      : '';

  if (!message) {
    return res.status(400).json({
      error: 'Bạn chưa nhập tin nhắn.'
    });
  }

  if (message.length > 10000) {
    return res.status(413).json({
      error: 'Tin nhắn quá dài (tối đa 10.000 ký tự).'
    });
  }

  if (previousInteractionId.length > 100) {
    return res.status(400).json({
      error: 'Mã hội thoại không hợp lệ.'
    });
  }

  // Xóa những phiên hội thoại đã hết hạn.
  const now = Date.now();

  for (const [id, session] of conversations) {
    if (now - session.updatedAt > SESSION_MAX_AGE) {
      conversations.delete(id);
    }
  }

  const sessionId =
    previousInteractionId &&
    conversations.has(previousInteractionId)
      ? previousInteractionId
      : randomUUID();

  const oldSession = conversations.get(sessionId);

  const contents = oldSession
    ? [...oldSession.contents]
    : [];

  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  // Chỉ giữ tối đa 20 lượt nội dung gần nhất.
  const limitedContents = contents.slice(-40);

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: limitedContents
  };

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

  // Thử lại tối đa 4 lần khi Gemini quá tải hoặc giới hạn tốc độ.
  const maxAttempts = 4;
  const retryableStatuses = [429, 500, 502, 503, 504];

  try {
    let upstream;
    let responseText = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        upstream = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        responseText = await upstream.text();
      } finally {
        clearTimeout(timeout);
      }

      if (
        upstream.ok ||
        !retryableStatuses.includes(upstream.status) ||
        attempt === maxAttempts
      ) {
        break;
      }

      // Ưu tiên thời gian chờ Google gửi trong header Retry-After.
      let retryDelayMs = 0;
      const retryAfter = upstream.headers.get('retry-after');

      if (retryAfter) {
        const seconds = Number(retryAfter);

        if (Number.isFinite(seconds) && seconds > 0) {
          retryDelayMs = seconds * 1000;
        } else {
          const retryDate = Date.parse(retryAfter);

          if (Number.isFinite(retryDate)) {
            retryDelayMs = Math.max(0, retryDate - Date.now());
          }
        }
      }

      // Nếu không có Retry-After, dùng thời gian chờ tăng dần.
      if (retryDelayMs <= 0) {
        const backoffMs = Math.min(
          2000 * (2 ** (attempt - 1)),
          15000
        );

        retryDelayMs = backoffMs + Math.floor(Math.random() * 1000);
      }

      // Không chờ quá lâu trong một request.
      retryDelayMs = Math.min(retryDelayMs, 20000);

      console.warn(
        `Gemini báo lỗi ${upstream.status}. Thử lại ${attempt + 1}/${maxAttempts} sau ${retryDelayMs}ms.`
      );

      await new Promise(resolve =>
        setTimeout(resolve, retryDelayMs)
      );
    }

    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }

    if (!upstream.ok) {
      console.error(
        'Gemini API error:',
        upstream.status,
        responseText.slice(0, 2000)
      );

      if (upstream.status === 401 || upstream.status === 403) {
        return res.status(502).json({
          error: 'Google từ chối xác thực API key hoặc quyền truy cập.'
        });
      }

      if (upstream.status === 429) {
        return res.status(429).json({
          error: 'Gemini đang giới hạn số yêu cầu (429). Hãy đợi một chút rồi thử lại; nếu lỗi kéo dài, cần kiểm tra quota và giới hạn API.'
        });
      }

      if (upstream.status === 503) {
        return res.status(503).json({
          error: 'Gemini hiện đang quá tải (503). PEAK đã thử kết nối lại nhưng chưa thành công. Vui lòng thử lại sau.'
        });
      }

      return res.status(502).json({
        error: 'Gemini chưa thể trả lời. Vui lòng thử lại sau.'
      });
    }

    const reply = (data.candidates || [])
      .flatMap(candidate => candidate.content?.parts || [])
      .filter(part => typeof part.text === 'string')
      .map(part => part.text)
      .join('\n')
      .trim();

    if (!reply) {
      console.error(
        'Gemini không trả về nội dung:',
        JSON.stringify(data).slice(0, 2000)
      );

      return res.status(502).json({
        error: 'Gemini chưa trả về nội dung văn bản.'
      });
    }

    // Chỉ lưu hội thoại khi Gemini trả lời thành công.
    const updatedContents = [
      ...limitedContents,
      {
        role: 'model',
        parts: [{ text: reply }]
      }
    ].slice(-40);

    conversations.set(sessionId, {
      contents: updatedContents,
      updatedAt: Date.now()
    });

    return res.json({
      reply,
      interactionId: sessionId,
      model: GEMINI_MODEL
    });

  } catch (error) {
    const timedOut = error?.name === 'AbortError';

    console.error('PEAK server error:', error);

    return res.status(timedOut ? 504 : 500).json({
      error: timedOut
        ? 'Gemini phản hồi quá lâu. Vui lòng thử lại.'
        : 'Máy chủ PEAK gặp lỗi khi kết nối Gemini.'
    });
  }
});

app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny'
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PEAK AI đang chạy tại http://localhost:${PORT}`);
  console.log(`Model: ${GEMINI_MODEL}`);

  if (!GEMINI_API_KEY) {
    console.warn('Thiếu GEMINI_API_KEY trong file .env.');
  }
});
