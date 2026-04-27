export interface FanClubProps {
  readonly id: string;
  readonly idolId: string;
  readonly tier: 'official';
  readonly price: number; // KRW; 0 = free (MVP)
}

export class FanClub {
  constructor(private readonly props: FanClubProps) {}
  get id() { return this.props.id; }
  get idolId() { return this.props.idolId; }
  get tier() { return this.props.tier; }
  get price() { return this.props.price; }
  toJSON() { return { ...this.props }; }
}
