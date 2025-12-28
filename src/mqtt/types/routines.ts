export interface RoutineStep {
  type: RoutineType;
  decision: RoutineDecision;
  action: RoutineAction;
}

export enum RoutineType {
  T = 'T',
  L_left = 'L_left',
  L_right = 'L_right',
  end = 'end',
}

export enum RoutineDecision {
  left = 'left',
  right = 'right',
  none = 'none',
}

export enum RoutineAction {
  clean_mode = 'clean_mode',
  returning_base = 'returning_base',
  none = 'none',
}
