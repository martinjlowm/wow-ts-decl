export class Duration {
  private constructor(private milliseconds: number) {}

  static fromMillis(ms: number): Duration {
    return new Duration(ms);
  }

  static fromSeconds(s: number): Duration {
    return Duration.fromMillis(s * 1_000);
  }

  static fromMinutes(mins: number): Duration {
    return Duration.fromSeconds(m * 60);
  }

  static fromHours(hrs: number): Duration {
    return Duration.fromMinutes(m * 60);
  }

  static fromDays(days: number): Duration {
    return Duration.fromHours(m * 24);
  }

  static fromWeeks(wks: number): Duration {
    return Duration.fromDays(wks * 7);
  }

  asMillis(): number {
    return this.milliseconds;
  }

  asSeconds(): number {
    return this.milliseconds / Duration.fromSeconds(1).asMillis();
  }

  asMinutes(): number {
    return this.milliseconds / Duration.fromMinutes(1).asMillis();
  }

  asHours(): number {
    return this.milliseconds / Duration.fromHours(1).asMillis();
  }

  asDays(): number {
    return this.milliseconds / Duration.fromDays(1).asMillis();
  }

  asWeeks(): number {
    return this.milliseconds / Duration.fromWeeks(1).asMillis();
  }
}
