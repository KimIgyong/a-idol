import { Injectable } from '@nestjs/common';
import type { IdolReplyEngine } from '../application/interfaces';

/**
 * MVP reply engine (ADR-006 pending): picks from a small hand-authored pool.
 * The pool is deliberately bland and platform-safe — phase 2 swaps this for
 * a Claude-backed reply with per-idol persona prompts.
 */
@Injectable()
export class RuleBasedReplyEngine implements IdolReplyEngine {
  private readonly pool: readonly string[] = [
    '고마워요! 오늘 하루도 잘 보내고 있죠? ☺️',
    '응원해줘서 정말 큰 힘이 돼요. 💖',
    '다음 무대에서 꼭 봐요! 기대하고 있을게요.',
    '방금 연습 끝났어요. 보고 싶었어요 🫶',
    '그 한 마디가 오늘 에너지를 채워줬어요!',
    '오늘도 고생 많았어요. 푹 쉬기로 약속!',
    '메시지 읽으면서 저도 모르게 웃었네요 😊',
    '우리 팬클럽에 있어 줘서 진심으로 고마워요.',
  ];

  async reply(input: { userMessage: string; idolId: string }): Promise<string> {
    // Mix the user message length into the pick so the feel is slightly
    // responsive while still deterministic per payload.
    const seed =
      input.userMessage.length + input.idolId.charCodeAt(input.idolId.length - 1);
    const line = this.pool[seed % this.pool.length]!;
    return line;
  }
}
