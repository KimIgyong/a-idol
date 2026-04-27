import type { ChatSenderType } from '@a-idol/shared';

export interface ChatMessageProps {
  readonly id: string;
  readonly roomId: string;
  readonly senderType: ChatSenderType;
  readonly content: string;
  readonly createdAt: Date;
}

export class ChatMessage {
  private constructor(private readonly props: ChatMessageProps) {}

  static create(props: ChatMessageProps): ChatMessage {
    return new ChatMessage(props);
  }

  get id() { return this.props.id; }
  get roomId() { return this.props.roomId; }
  get senderType() { return this.props.senderType; }
  get content() { return this.props.content; }
  get createdAt() { return this.props.createdAt; }

  toJSON() { return { ...this.props }; }
}
