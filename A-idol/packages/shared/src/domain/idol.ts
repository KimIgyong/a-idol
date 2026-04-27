export interface IdolProps {
  readonly id: string;
  readonly agencyId: string;
  readonly name: string;
  readonly stageName: string | null;
  readonly mbti: string | null;
  readonly bio: string | null;
  readonly heroImageUrl: string | null;
  readonly heartCount: number;
  readonly followCount: number;
  readonly publishedAt: Date | null;
}

export class Idol {
  constructor(private readonly props: IdolProps) {}
  get id() { return this.props.id; }
  get name() { return this.props.name; }
  get agencyId() { return this.props.agencyId; }
  get isPublished() { return this.props.publishedAt !== null && this.props.publishedAt <= new Date(); }
  toJSON() { return { ...this.props }; }
}
