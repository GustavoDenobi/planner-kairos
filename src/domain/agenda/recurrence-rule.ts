export type WeeklyRule = {
  frequency: 'weekly';
  interval: number;
  byWeekday: number[];
};

export type MonthlyDayOfMonthRule = {
  frequency: 'monthly';
  mode: 'dayOfMonth';
  day: number;
  interval: number;
};

export type MonthlyNthWeekdayRule = {
  frequency: 'monthly';
  mode: 'nthWeekday';
  weekday: number;
  nth: number;
  interval: number;
};

export type MonthlyRule = MonthlyDayOfMonthRule | MonthlyNthWeekdayRule;

export type RecurrenceRule = WeeklyRule | MonthlyRule;

export function isWeeklyRule(rule: RecurrenceRule): rule is WeeklyRule {
  return rule.frequency === 'weekly';
}

export function isMonthlyRule(rule: RecurrenceRule): rule is MonthlyRule {
  return rule.frequency === 'monthly';
}
