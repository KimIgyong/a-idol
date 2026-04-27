export interface ChatRoomProps {
  readonly id: string;
  readonly userId: string;
  readonly idolId: string;
  readonly createdAt: Date;
  readonly lastMessageAt: Date | null;
}

export class ChatRoom {
  private constructor(private readonly props: ChatRoomProps) {}

  static create(props: ChatRoomProps): ChatRoom {
    return new ChatRoom(props);
  }

  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get idolId() { return this.props.idolId; }
  get createdAt() { return this.props.createdAt; }
  get lastMessageAt() { return this.props.lastMessageAt; }

  belongsTo(userId: string): boolean {
    return this.props.userId === userId;
  }

  toJSON() { return { ...this.props }; }
}
