export interface MembershipProps {
  readonly id: string;
  readonly userId: string;
  readonly fanClubId: string;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

export class Membership {
  constructor(private readonly props: MembershipProps) {}
  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get fanClubId() { return this.props.fanClubId; }
  get isActive() { return this.props.leftAt === null; }
  canChat(): boolean { return this.isActive; }
  toJSON() { return { ...this.props }; }
}
