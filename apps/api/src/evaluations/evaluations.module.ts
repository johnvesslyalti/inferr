import { Module } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';

/**
 * EvaluationsModule — exports EvaluationsService for use by ChatModule.
 *
 * Deliberately kept lightweight: no controller (evaluations are internal
 * background tasks, not a user-facing endpoint). Import into any module
 * that needs to trigger evaluation after an LLM response.
 */
@Module({
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
