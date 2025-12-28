import {
  RoutineStep,
  RoutineType,
  RoutineDecision,
  RoutineAction,
} from '../types/routines';

export const leftRoutine: RoutineStep[] = [
  {
    type: RoutineType.T,
    decision: RoutineDecision.left,
    action: RoutineAction.none,
  },
  {
    type: RoutineType.T,
    decision: RoutineDecision.none,
    action: RoutineAction.clean_mode,
  },
  {
    type: RoutineType.L_right,
    decision: RoutineDecision.right,
    action: RoutineAction.none,
  },
  {
    type: RoutineType.end,
    decision: RoutineDecision.none,
    action: RoutineAction.returning_base,
  },
];

export const rightRoutine: RoutineStep[] = [
  {
    type: RoutineType.T,
    decision: RoutineDecision.right,
    action: RoutineAction.none,
  },
  {
    type: RoutineType.T,
    decision: RoutineDecision.none,
    action: RoutineAction.clean_mode,
  },
  {
    type: RoutineType.L_left,
    decision: RoutineDecision.right,
    action: RoutineAction.none,
  },
  {
    type: RoutineType.end,
    decision: RoutineDecision.none,
    action: RoutineAction.returning_base,
  },
];
